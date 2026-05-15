import { z } from 'zod';
import { ROLES } from '../constants';

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'Contraseña demasiado larga'),
  role: z.enum(ROLES).default('investor'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LinkWalletSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Wallet inválida')
    .transform((v) => v.toLowerCase() as `0x${string}`),
  message: z.string().min(20, 'Mensaje SIWE inválido'),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, 'Firma inválida'),
});
export type LinkWalletDto = z.infer<typeof LinkWalletSchema>;

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'investor' | 'issuer' | 'admin';
  iat?: number;
  exp?: number;
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'investor' | 'issuer' | 'admin';
  primaryWallet: `0x${string}` | null;
  kycStatus: 'pending' | 'verified' | 'rejected' | null;
}
