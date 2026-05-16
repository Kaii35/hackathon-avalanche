import { recoverMessageAddress } from 'viem';
import { prisma } from '@hack/database';
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
import { auditService } from './audit.service';

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

    // Admin pre-registration gate: an AdminInvite row with status='pending'
    // must exist for this email. Same generic error message regardless of
    // why (no invite vs revoked vs already consumed) so attackers can't
    // probe which emails are pre-approved.
    let inviteIdToConsume: string | null = null;
    if (dto.role === 'admin') {
      const invite = await prisma.adminInvite.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (!invite || invite.status !== 'pending') {
        throw new AuthError('No autorizado para registro de administrador');
      }
      inviteIdToConsume = invite.id;
    }

    const passwordHash = await hashPassword(dto.password);

    // Wrap user creation + invite consumption in a single transaction so a
    // crash mid-write can't leave us with an admin user and an unconsumed
    // invite (or vice versa).
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      if (inviteIdToConsume) {
        // Re-check inside the tx and consume atomically. If a concurrent
        // request already consumed the invite, this update finds 0 rows.
        const updated = await tx.adminInvite.updateMany({
          where: { id: inviteIdToConsume, status: 'pending' },
          data: { status: 'consumed', consumedById: user.id, consumedAt: new Date() },
        });
        if (updated.count === 0) {
          throw new AuthError('No autorizado para registro de administrador');
        }
      }
      return user;
    });

    if (inviteIdToConsume) {
      // Audit outside the tx — the user is already created, this is just for
      // the compliance log. Failure here shouldn't roll back the registration.
      await auditService
        .record({
          action: 'admin.invite.consumed',
          actor: created.email,
          target: created.email,
          payload: { inviteId: inviteIdToConsume, userId: created.id },
        })
        .catch(() => {
          /* swallow — audit failure shouldn't break the signup */
        });
    }

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

    // Panel gating — reject login from the wrong panel BEFORE issuing JWT.
    // We use the same generic "Credenciales inválidas" message so attackers
    // can't probe whether an email belongs to admin vs investor.
    if (dto.panel === 'admin' && user.role !== 'admin') {
      throw new AuthError('Credenciales inválidas');
    }
    if (dto.panel === 'user' && user.role !== 'investor' && user.role !== 'issuer') {
      throw new AuthError('Credenciales inválidas');
    }

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
