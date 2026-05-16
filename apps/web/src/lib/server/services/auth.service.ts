import { recoverMessageAddress } from 'viem';
import {
  AuthError,
  ConflictError,
  type LoginDto,
  type RegisterDto,
  type LinkWalletDto,
  type SessionUser,
  SIWE_DOMAIN,
} from '@hack/shared';
import { userRepo } from '../repositories/user.repo';
import { hashPassword, verifyPassword } from '../auth/password';
import { signJwt } from '../auth/jwt';

interface UserShape {
  id: string;
  email: string;
  role: 'investor' | 'issuer' | 'admin';
  firstName: string | null;
  lastName: string | null;
  wallets: { address: string; isPrimary: boolean }[];
  identities: { kycStatus: 'pending' | 'verified' | 'rejected' }[];
}

function emailLocalPart(email: string): string {
  return email.split('@')[0] ?? email;
}

function toSessionUser(user: UserShape): SessionUser {
  const first = user.firstName?.trim() ?? '';
  const last = user.lastName?.trim() ?? '';
  const displayName = [first, last].filter(Boolean).join(' ') || emailLocalPart(user.email);
  const initials = ((first[0] ?? '') + (last[0] ?? '') || emailLocalPart(user.email).slice(0, 2))
    .toUpperCase()
    .slice(0, 2);
  const primary = user.wallets.find((w) => w.isPrimary) ?? user.wallets[0];
  const identity = user.identities[0];
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName,
    initials,
    role: user.role,
    primaryWallet: (primary?.address ?? null) as `0x${string}` | null,
    kycStatus: identity?.kycStatus ?? null,
  };
}

export const authService = {
  async register(dto: RegisterDto): Promise<{ token: string; user: SessionUser }> {
    const existing = await userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError('Ya existe una cuenta con ese email');
    const passwordHash = await hashPassword(dto.password);
    const created = await userRepo.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    const token = await signJwt({ sub: created.id, email: created.email, role: created.role });
    const user = toSessionUser({
      id: created.id,
      email: created.email,
      role: created.role,
      firstName: created.firstName,
      lastName: created.lastName,
      wallets: [],
      identities: [],
    });
    return { token, user };
  },

  async login(dto: LoginDto): Promise<{ token: string; user: SessionUser }> {
    const user = await userRepo.findByEmail(dto.email);
    if (!user) throw new AuthError('Credenciales inválidas');
    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) throw new AuthError('Credenciales inválidas');
    const token = await signJwt({ sub: user.id, email: user.email, role: user.role });
    return { token, user: toSessionUser(user) };
  },

  async session(userId: string): Promise<SessionUser | null> {
    const user = await userRepo.findById(userId);
    if (!user) return null;
    return toSessionUser(user);
  },

  async linkWallet(userId: string, dto: LinkWalletDto): Promise<{ address: `0x${string}` }> {
    if (!dto.message.includes(SIWE_DOMAIN)) {
      throw new AuthError('Mensaje SIWE inválido');
    }
    // `dto.address` is lowercased by the Zod transform, but the message
    // carries the EIP-55 checksum form (mixed case). Compare case-insensitively
    // so a wallet like 0xA24f… matches its lowercased counterpart.
    if (!dto.message.toLowerCase().includes(dto.address)) {
      throw new AuthError('La dirección no coincide con el mensaje firmado');
    }
    const recovered = await recoverMessageAddress({
      message: dto.message,
      signature: dto.signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== dto.address.toLowerCase()) {
      throw new AuthError('Firma inválida');
    }
    await userRepo.linkWallet(userId, dto.address);
    return { address: dto.address };
  },
};
