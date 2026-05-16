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

// — Admin invites (pre-registration list for admin accounts) —

export const CreateAdminInviteSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.trim().toLowerCase()),
  note: z.string().trim().max(500, 'Nota demasiado larga').optional(),
});
export type CreateAdminInviteDto = z.infer<typeof CreateAdminInviteSchema>;

export type AdminInviteStatus = 'pending' | 'consumed' | 'revoked';

export interface AdminInviteDto {
  id: string;
  email: string;
  status: AdminInviteStatus;
  note: string | null;
  invitedBy: { email: string; displayName: string } | null;
  consumedBy: { email: string; displayName: string } | null;
  consumedAt: string | null;
  createdAt: string;
}
