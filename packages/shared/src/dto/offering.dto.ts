import { z } from 'zod';
import { OFFERING_STATUSES } from '../constants';
import { JURISDICTION_MX } from '../types/identity';

const decimalString = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Número decimal inválido');

export const CreateOfferingSchema = z.object({
  // Optional — when omitted, the API resolves it from the authenticated user
  // via issuerService.ensureForUser(). The frontend doesn't know its own
  // Issuer.id, so this is the common case.
  issuerId: z.string().uuid('Issuer inválido').optional(),
  name: z.string().min(3).max(120),
  symbol: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Símbolo solo en mayúsculas y números')
    .transform((v) => v.toUpperCase()),
  // Loosened from "min 10 chars" — real Pinata integration is a follow-up.
  // Until then the frontend may pass a placeholder, URL or descriptive string.
  prospectusIpfs: z.string().max(512).optional().default(''),
  totalSupply: decimalString,
  pricePerUnit: decimalString,
  lockupUntil: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
  maxHolders: z.number().int().positive().max(2000),
  allowedJurisdictions: z.array(z.number().int().positive()).min(1).default([JURISDICTION_MX]),
  sector: z.string().min(2).max(80),
  description: z.string().min(20).max(4000),
});
export type CreateOfferingDto = z.infer<typeof CreateOfferingSchema>;

/**
 * Subset of CreateOfferingSchema fields that the Issuer can edit AFTER deploy.
 * Immutable on-chain (symbol, totalSupply, tokenAddress) are deliberately omitted.
 * pricePerUnit / maxHolders / allowedJurisdictions are mutable in the DB
 * (off-chain metadata) — they don't retroactively change the deployed
 * SecurityToken or its bound compliance modules.
 */
export const UpdateOfferingSchema = z
  .object({
    name: z.string().min(3).max(120).optional(),
    description: z.string().min(20).max(4000).optional(),
    sector: z.string().min(2).max(80).optional(),
    prospectusIpfs: z.string().max(512).optional(),
    pricePerUnit: decimalString.optional(),
    maxHolders: z.number().int().positive().max(2000).optional(),
    allowedJurisdictions: z.array(z.number().int().positive()).min(1).optional(),
    status: z.enum(OFFERING_STATUSES).optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'No hay campos para actualizar',
  });
export type UpdateOfferingDto = z.infer<typeof UpdateOfferingSchema>;

export const OfferingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(OFFERING_STATUSES).optional(),
  issuerId: z.string().uuid().optional(),
  search: z.string().max(120).optional(),
  // Convenience filter for the "Mis ofertas" page: when 'true', the API
  // resolves the authenticated user's Issuer and applies it as issuerId.
  // The frontend doesn't know its own Issuer.id (auto-created server-side).
  mine: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
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
}

export interface CapTableRowDto {
  wallet: `0x${string}`;
  balance: string;
  percentOfTotal: number;
  lastUpdatedBlock: string;
}
