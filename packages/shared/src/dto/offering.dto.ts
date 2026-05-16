import { z } from 'zod';
import { OFFERING_STATUSES } from '../constants';
import { JURISDICTION_MX } from '../types/identity';

const decimalString = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Número decimal inválido');

export const CreateOfferingSchema = z.object({
  issuerId: z.string().uuid('Issuer inválido'),
  name: z.string().min(3).max(120),
  symbol: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Símbolo solo en mayúsculas y números')
    .transform((v) => v.toUpperCase()),
  prospectusIpfs: z.string().min(10, 'CID IPFS requerido'),
  totalSupply: decimalString,
  pricePerUnit: decimalString,
  lockupUntil: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
  maxHolders: z.number().int().positive().max(2000),
  allowedJurisdictions: z.array(z.number().int().positive()).min(1).default([JURISDICTION_MX]),
  sector: z.string().min(2).max(80),
  description: z.string().min(20).max(4000),
});
export type CreateOfferingDto = z.infer<typeof CreateOfferingSchema>;

export const OfferingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(OFFERING_STATUSES).optional(),
  issuerId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
});
export type OfferingsQueryDto = z.infer<typeof OfferingsQuerySchema>;

export interface OfferingResponseDto {
  id: string;
  issuerId: string;
  issuerName: string;
  tokenAddress: `0x${string}` | null;
  name: string;
  symbol: string;
  sector: string;
  description: string;
  prospectusIpfs: string;
  totalSupply: string;
  pricePerUnit: string;
  lockupUntil: string;
  maxHolders: number;
  allowedJurisdictions: number[];
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
  /** Holders únicos con balance > 0 — derivado de capTableEntry (indexer). */
  holders?: number;
  /** Precio del trade más reciente (USDC/share). Si no hay trades, usa pricePerUnit. */
  lastTradePrice?: number;
  /** Suma de paymentAmount de trades en las últimas 24h (USDC). */
  volume24h?: number;
  /** % financiado vs totalSupply — heurística simple para el dashboard. */
  fundedPct?: number;
}

export interface CapTableRowDto {
  wallet: `0x${string}`;
  balance: string;
  percentOfTotal: number;
  lastUpdatedBlock: string;
}
