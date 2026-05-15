import { z } from 'zod';
import { JURISDICTION_MX } from '../types/identity';

export const KycStartSchema = z.object({
  fullName: z.string().min(3, 'Nombre completo requerido'),
  rfc: z
    .string()
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, 'RFC inválido')
    .transform((v) => v.toUpperCase()),
  curp: z
    .string()
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/i, 'CURP inválido')
    .transform((v) => v.toUpperCase()),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
  jurisdiction: z.number().int().positive().default(JURISDICTION_MX),
  accredited: z.boolean().default(false),
  documentNumber: z.string().min(5, 'Número de documento requerido'),
});
export type KycStartDto = z.infer<typeof KycStartSchema>;

export const KycWebhookSchema = z.object({
  externalId: z.string().min(1),
  status: z.enum(['verified', 'rejected', 'pending']),
  payload: z.record(z.unknown()),
  signature: z.string().min(1),
});
export type KycWebhookDto = z.infer<typeof KycWebhookSchema>;

export interface KycResponseDto {
  status: 'pending' | 'verified' | 'rejected';
  jurisdiction: number;
  accredited: boolean;
  verifiedAt: string | null;
}
