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

export const offeringService = {
  async list(q: OfferingsQueryDto) {
    const { items, total } = await offeringRepo.list(q);
    return {
      items: items.map(toResponse),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  },

  async get(id: string): Promise<OfferingResponseDto> {
    const o = await offeringRepo.findById(id);
    if (!o) throw new NotFoundError('Oferta');
    return toResponse(o);
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
