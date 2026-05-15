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

export const authService = {
  async register(dto: RegisterDto): Promise<{ token: string; user: SessionUser }> {
    const existing = await userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError('Ya existe una cuenta con ese email');
    const passwordHash = await hashPassword(dto.password);
    const user = await userRepo.create({ email: dto.email, passwordHash, role: dto.role });
    const token = await signJwt({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        primaryWallet: null,
        kycStatus: null,
      },
    };
  },

  async login(dto: LoginDto): Promise<{ token: string; user: SessionUser }> {
    const user = await userRepo.findByEmail(dto.email);
    if (!user) throw new AuthError('Credenciales inválidas');
    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) throw new AuthError('Credenciales inválidas');
    const token = await signJwt({ sub: user.id, email: user.email, role: user.role });
    const primary = user.wallets.find((w) => w.isPrimary) ?? user.wallets[0];
    const identity = user.identities[0];
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        primaryWallet: (primary?.address ?? null) as `0x${string}` | null,
        kycStatus: identity?.kycStatus ?? null,
      },
    };
  },

  async session(userId: string): Promise<SessionUser | null> {
    const user = await userRepo.findById(userId);
    if (!user) return null;
    const primary = user.wallets.find((w) => w.isPrimary) ?? user.wallets[0];
    const identity = user.identities[0];
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      primaryWallet: (primary?.address ?? null) as `0x${string}` | null,
      kycStatus: identity?.kycStatus ?? null,
    };
  },

  async linkWallet(userId: string, dto: LinkWalletDto): Promise<{ address: `0x${string}` }> {
    if (!dto.message.includes(SIWE_DOMAIN)) {
      throw new AuthError('Mensaje SIWE inválido');
    }
    if (!dto.message.includes(dto.address)) {
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
