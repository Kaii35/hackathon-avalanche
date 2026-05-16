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
  firstName: z.string().trim().min(1, 'Ingresa tu nombre').max(80, 'Nombre demasiado largo'),
  lastName: z.string().trim().min(1, 'Ingresa tu apellido').max(80, 'Apellido demasiado largo'),
  role: z.enum(ROLES).default('investor'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const UpdateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'Ingresa tu nombre').max(80, 'Nombre demasiado largo'),
  lastName: z.string().trim().min(1, 'Ingresa tu apellido').max(80, 'Apellido demasiado largo'),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

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
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  initials: string;
  role: 'investor' | 'issuer' | 'admin';
  primaryWallet: `0x${string}` | null;
  kycStatus: 'pending' | 'verified' | 'rejected' | null;
}
