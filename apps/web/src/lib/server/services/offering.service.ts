import { prisma, Prisma } from '@hack/database';
import {
  NotFoundError,
  ForbiddenError,
  type CapTableRowDto,
  type CreateOfferingDto,
  type OfferingResponseDto,
  type OfferingsQueryDto,
  type UpdateOfferingDto,
} from '@hack/shared';
import { offeringRepo } from '../repositories/offering.repo';
import { chainDeployOffering } from '../chain/tokenFactory';
import { auditService } from './audit.service';
import { issuerService } from './issuer.service';
import { logger } from '../logger';

function toResponse(o: {
  id: string;
  issuerId: string;
  name: string;
  symbol: string;
  prospectusIpfs: string;
  totalSupply: Prisma.Decimal;
  pricePerUnit: Prisma.Decimal;
  lockupUntil: Date;
  maxHolders: number;
  allowedJurisdictions: number[];
  status: 'draft' | 'active' | 'closed';
  sector: string;
  description: string;
  tokenAddress: string | null;
  createdAt: Date;
  issuer: { name: string };
}): OfferingResponseDto {
  return {
    id: o.id,
    issuerId: o.issuerId,
    issuerName: o.issuer.name,
    tokenAddress: o.tokenAddress as `0x${string}` | null,
    name: o.name,
    symbol: o.symbol,
    sector: o.sector,
    description: o.description,
    prospectusIpfs: o.prospectusIpfs,
    totalSupply: o.totalSupply.toString(),
    pricePerUnit: o.pricePerUnit.toString(),
    lockupUntil: o.lockupUntil.toISOString(),
    maxHolders: o.maxHolders,
    allowedJurisdictions: o.allowedJurisdictions,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  };
}

/**
 * Aggregates real metrics per offering (holders + last trade price + 24h volume)
 * directly from Postgres. The indexer keeps cap_table_entries and trades fresh,
 * so this is always up-to-date with the chain.
 *
 * For N offerings this does 3 grouped queries (not N×3) → constant cost.
 */
async function aggregateMetrics(
  offeringIds: string[],
): Promise<Map<string, { holders: number; lastTradePrice?: number; volume24h: number }>> {
  if (offeringIds.length === 0) return new Map();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [holderCounts, latestTrades, last24h] = await Promise.all([
    // Unique holders with balance > 0
    prisma.capTableEntry.groupBy({
      by: ['offeringId'],
      where: {
        offeringId: { in: offeringIds },
        balance: { gt: 0 },
      },
      _count: { wallet: true },
    }),
    // Last trade per offering (price reflects most recent settlement)
    prisma.$queryRaw<{ offering_id: string; price: Prisma.Decimal }[]>`
      SELECT DISTINCT ON (offering_id) offering_id, price
      FROM trades
      WHERE offering_id::text = ANY(${offeringIds})
      ORDER BY offering_id, settled_at DESC
    `,
    // 24h volume (qty * price summed)
    prisma.trade.findMany({
      where: { offeringId: { in: offeringIds }, settledAt: { gte: cutoff } },
      select: { offeringId: true, qty: true, price: true },
    }),
  ]);

  const map = new Map<string, { holders: number; lastTradePrice?: number; volume24h: number }>();
  for (const h of holderCounts) {
    map.set(h.offeringId, { holders: h._count.wallet, volume24h: 0 });
  }
  for (const lt of latestTrades) {
    const entry = map.get(lt.offering_id) ?? { holders: 0, volume24h: 0 };
    entry.lastTradePrice = Number(lt.price);
    map.set(lt.offering_id, entry);
  }
  for (const t of last24h) {
    const entry = map.get(t.offeringId) ?? { holders: 0, volume24h: 0 };
    entry.volume24h += Number(t.qty) * Number(t.price);
    map.set(t.offeringId, entry);
  }
  return map;
}

function enrichWithMetrics(
  base: OfferingResponseDto,
  metrics?: { holders: number; lastTradePrice?: number; volume24h: number },
): OfferingResponseDto {
  if (!metrics) {
    return {
      ...base,
      holders: 0,
      volume24h: 0,
      lastTradePrice: Number(base.pricePerUnit),
      fundedPct: 0,
    };
  }
  const totalSupplyNum = Number(base.totalSupply);
  // Heuristic for fundedPct: until we have a "primary issuance" milestone in
  // the data model, we approximate using lifetime trade volume divided by
  // primary cap (totalSupply × pricePerUnit). Capped at 100.
  const primaryCap = totalSupplyNum * Number(base.pricePerUnit);
  const fundedPct =
    primaryCap > 0 ? Math.min(100, Math.round((metrics.volume24h / primaryCap) * 100)) : 0;
  return {
    ...base,
    holders: metrics.holders,
    volume24h: Number(metrics.volume24h.toFixed(2)),
    lastTradePrice: metrics.lastTradePrice ?? Number(base.pricePerUnit),
    fundedPct,
  };
}

export const offeringService = {
  async list(q: OfferingsQueryDto) {
    const { items, total } = await offeringRepo.list(q);
    const base = items.map(toResponse);
    const metrics = await aggregateMetrics(base.map((b) => b.id));
    return {
      items: base.map((b) => enrichWithMetrics(b, metrics.get(b.id))),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  },

  async get(id: string): Promise<OfferingResponseDto> {
    const o = await offeringRepo.findById(id);
    if (!o) throw new NotFoundError('Oferta');
    const base = toResponse(o);
    const metrics = await aggregateMetrics([id]);
    return enrichWithMetrics(base, metrics.get(id));
  },

  /**
   * Create an Offering row and (best-effort) deploy its SecurityToken on Fuji.
   *
   * `user` carries the authenticated user — if `dto.issuerId` is missing we
   * auto-create an Issuer record for that user (idempotent).
   *
   * On-chain deploy is BEST-EFFORT: if the helper reports an error or the
   * chain isn't configured, the Offering stays in 'draft' status with a null
   * tokenAddress. The page can later retry, or an admin can manually deploy.
   * We never let a chain failure prevent the DB row from being created — the
   * audit log captures both paths.
   */
  async create(
    user: { sub: string; email: string },
    dto: CreateOfferingDto,
  ): Promise<OfferingResponseDto> {
    // 1) Resolve the Issuer row (auto-create on first offering)
    const issuerRef = dto.issuerId
      ? await prisma.issuer.findUniqueOrThrow({
          where: { id: dto.issuerId },
          select: { id: true, name: true, kycIssuerAddress: true },
        })
      : await (async () => {
          const minimal = await issuerService.ensureForUser(user.sub);
          const full = await prisma.issuer.findUnique({
            where: { id: minimal.id },
            select: { id: true, name: true, kycIssuerAddress: true },
          });
          if (!full) throw new Error('Failed to resolve Issuer after ensureForUser');
          return full;
        })();

    // 2) Persist the Offering as draft
    const created = await offeringRepo.create({
      issuer: { connect: { id: issuerRef.id } },
      name: dto.name,
      symbol: dto.symbol,
      sector: dto.sector,
      description: dto.description,
      prospectusIpfs: dto.prospectusIpfs ?? '',
      totalSupply: new Prisma.Decimal(dto.totalSupply),
      pricePerUnit: new Prisma.Decimal(dto.pricePerUnit),
      lockupUntil: new Date(dto.lockupUntil),
      maxHolders: dto.maxHolders,
      allowedJurisdictions: dto.allowedJurisdictions,
      status: 'draft',
    });

    await auditService.record({
      action: 'offering.created',
      actor: user.email,
      target: created.id,
      payload: { name: dto.name, symbol: dto.symbol, issuerId: issuerRef.id },
    });

    // 3) Deploy SecurityToken via TokenFactory.deployOffering on Fuji.
    // Supply is denominated in 1e18 wei (SecurityToken has 18 decimals).
    const initialSupplyWei = (() => {
      const [whole, frac = ''] = dto.totalSupply.split('.');
      const wholePart = BigInt(whole ?? '0') * 10n ** 18n;
      const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
      const fracPart = fracPadded ? BigInt(fracPadded) : 0n;
      return wholePart + fracPart;
    })();

    const initialRecipient =
      initialSupplyWei > 0n ? (issuerRef.kycIssuerAddress as `0x${string}` | undefined) : undefined;

    const result = await chainDeployOffering({
      offeringUuid: created.id,
      name: dto.name,
      symbol: dto.symbol,
      initialSupplyWei,
      initialRecipient,
    });

    if (!result.ok) {
      // Chain failure → keep the offering as draft and surface the reason via
      // audit log. The Issuer can retry from the dashboard later.
      const reason = 'skipped' in result && result.skipped ? result.reason : result.error;
      logger.warn({ offeringId: created.id, reason }, 'offering.deploy.skipped_or_failed');
      await auditService.record({
        action: 'offering.deploy.skipped',
        actor: user.email,
        target: created.id,
        payload: { reason },
      });
      return toResponse({ ...created, issuer: { name: issuerRef.name } });
    }

    // 4) Persist the token address + flip to 'active' + audit
    const updated = await offeringRepo.setTokenAddress(created.id, result.tokenAddress, 'active');
    await auditService.record({
      action: 'offering.deployed',
      actor: user.email,
      target: created.id,
      payload: { tokenAddress: result.tokenAddress, offeringIdBytes32: result.offeringIdBytes32 },
      txHash: result.txHash,
    });

    return toResponse({ ...updated, issuer: { name: issuerRef.name } });
  },

  /**
   * Patch an Offering's mutable metadata. The Issuer that owns the offering
   * (or an admin) can call this; everyone else gets 403.
   *
   * Only DB fields are touched — the on-chain SecurityToken is immutable
   * w.r.t. name/symbol/supply. pricePerUnit, maxHolders and allowedJurisdictions
   * live in our DB only (they'd require module re-binding to take effect on chain).
   */
  async update(
    user: { sub: string; email: string; role: 'investor' | 'issuer' | 'admin' },
    id: string,
    dto: UpdateOfferingDto,
  ): Promise<OfferingResponseDto> {
    const existing = await offeringRepo.findById(id);
    if (!existing) throw new NotFoundError('Oferta');

    if (user.role !== 'admin') {
      const callerIssuer = await issuerService.ensureForUser(user.sub);
      if (existing.issuerId !== callerIssuer.id) {
        throw new ForbiddenError('No puedes editar una oferta de otro emisor');
      }
    }

    const data: Prisma.OfferingUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.prospectusIpfs !== undefined) data.prospectusIpfs = dto.prospectusIpfs;
    if (dto.pricePerUnit !== undefined) data.pricePerUnit = new Prisma.Decimal(dto.pricePerUnit);
    if (dto.maxHolders !== undefined) data.maxHolders = dto.maxHolders;
    if (dto.allowedJurisdictions !== undefined)
      data.allowedJurisdictions = dto.allowedJurisdictions;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await prisma.offering.update({
      where: { id },
      data,
      include: { issuer: { select: { name: true } } },
    });

    await auditService.record({
      action: 'offering.updated',
      actor: user.email,
      target: id,
      payload: { fields: Object.keys(dto) },
    });

    return toResponse(updated);
  },

  async capTable(offeringId: string): Promise<CapTableRowDto[]> {
    const offering = await offeringRepo.findById(offeringId);
    if (!offering) throw new NotFoundError('Oferta');
    const rows = await offeringRepo.capTable(offeringId);
    return rows.map((r) => ({
      wallet: r.wallet as `0x${string}`,
      balance: r.balance.toString(),
      percentOfTotal: Number(r.percentOfTotal),
      lastUpdatedBlock: r.lastUpdatedBlock.toString(),
    }));
  },
};
