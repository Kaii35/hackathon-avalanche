import { prisma, Prisma } from '@hack/database';
import {
  NotFoundError,
  type CapTableRowDto,
  type CreateOfferingDto,
  type OfferingResponseDto,
  type OfferingsQueryDto,
} from '@hack/shared';
import { offeringRepo } from '../repositories/offering.repo';
import { chainClient } from '../chain/client';
import { auditService } from './audit.service';

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

  async create(actor: string, dto: CreateOfferingDto): Promise<OfferingResponseDto> {
    const created = await offeringRepo.create({
      issuer: { connect: { id: dto.issuerId } },
      name: dto.name,
      symbol: dto.symbol,
      sector: dto.sector,
      description: dto.description,
      prospectusIpfs: dto.prospectusIpfs,
      totalSupply: new Prisma.Decimal(dto.totalSupply),
      pricePerUnit: new Prisma.Decimal(dto.pricePerUnit),
      lockupUntil: new Date(dto.lockupUntil),
      maxHolders: dto.maxHolders,
      allowedJurisdictions: dto.allowedJurisdictions,
      status: 'draft',
    });

    await auditService.record({
      action: 'offering.created',
      actor,
      target: created.id,
      payload: { name: dto.name, symbol: dto.symbol },
    });

    const issuer = await prisma.issuer.findUnique({ where: { id: dto.issuerId } });
    const initialHolder = (issuer?.kycIssuerAddress ??
      '0x0000000000000000000000000000000000000000') as `0x${string}`;
    const initialSupply = BigInt(Math.floor(Number(dto.totalSupply)));
    const tx = await chainClient.token.deploy({
      offeringId: created.id,
      name: dto.name,
      symbol: dto.symbol,
      initialHolder,
      initialSupply,
      lockupUntil: Math.floor(new Date(dto.lockupUntil).getTime() / 1000),
      maxHolders: dto.maxHolders,
      allowedJurisdictions: dto.allowedJurisdictions,
    });

    const updated = await offeringRepo.setTokenAddress(created.id, tx.tokenAddress, 'active');
    await auditService.record({
      action: 'offering.deployed',
      actor,
      target: created.id,
      payload: { tokenAddress: tx.tokenAddress },
      txHash: tx.txHash,
    });

    return toResponse({ ...updated, issuer: { name: issuer?.name ?? '' } });
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
