import { z } from 'zod';

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Dirección inválida')
  .transform((v) => v.toLowerCase() as `0x${string}`);

export const FreezeSchema = z.object({
  wallet: addressSchema,
  reason: z.string().min(5, 'Razón requerida').max(500),
});
export type FreezeDto = z.infer<typeof FreezeSchema>;

export const UnfreezeSchema = z.object({
  wallet: addressSchema,
  reason: z.string().min(5).max(500),
});
export type UnfreezeDto = z.infer<typeof UnfreezeSchema>;

export const WhitelistSchema = z.object({
  wallet: addressSchema,
  jurisdiction: z.number().int().positive(),
  accredited: z.boolean().default(false),
  action: z.enum(['add', 'remove']).default('add'),
});
export type WhitelistDto = z.infer<typeof WhitelistSchema>;

export const ForcedTransferSchema = z.object({
  offeringId: z.string().uuid(),
  from: addressSchema,
  to: addressSchema,
  qty: z.string().regex(/^\d+(\.\d{1,18})?$/),
  reason: z.string().min(5).max(500),
});
export type ForcedTransferDto = z.infer<typeof ForcedTransferSchema>;

export const ComplianceCheckQuerySchema = z.object({
  offeringId: z.string().uuid(),
  from: addressSchema,
  to: addressSchema,
  amount: z.string().regex(/^\d+(\.\d{1,18})?$/),
});
export type ComplianceCheckQueryDto = z.infer<typeof ComplianceCheckQuerySchema>;

export interface ComplianceCheckResponseDto {
  allowed: boolean;
  reasons: string[];
  checkedAt: string;
}

export interface AuditLogEntryDto {
  id: string;
  action: string;
  actor: string;
  target: string | null;
  payload: Record<string, unknown>;
  txHash: string | null;
  createdAt: string;
}
