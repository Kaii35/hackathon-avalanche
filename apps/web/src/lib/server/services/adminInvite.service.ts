import { prisma } from '@hack/database';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type AdminInviteDto,
  type CreateAdminInviteDto,
} from '@hack/shared';
import { adminInviteRepo } from '../repositories/adminInvite.repo';
import { auditService } from './audit.service';

function emailLocalPart(email: string): string {
  return email.split('@')[0] ?? email;
}

function displayNameFor(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const first = user.firstName?.trim() ?? '';
  const last = user.lastName?.trim() ?? '';
  return [first, last].filter(Boolean).join(' ') || emailLocalPart(user.email);
}

function toDto(
  invite: {
    id: string;
    email: string;
    status: 'pending' | 'consumed' | 'revoked';
    note: string | null;
    invitedById: string | null;
    consumedById: string | null;
    consumedAt: Date | null;
    createdAt: Date;
  },
  users: Map<string, { email: string; firstName: string | null; lastName: string | null }>,
): AdminInviteDto {
  const invitedBy = invite.invitedById ? users.get(invite.invitedById) : null;
  const consumedBy = invite.consumedById ? users.get(invite.consumedById) : null;
  return {
    id: invite.id,
    email: invite.email,
    status: invite.status,
    note: invite.note,
    invitedBy: invitedBy
      ? { email: invitedBy.email, displayName: displayNameFor(invitedBy) }
      : null,
    consumedBy: consumedBy
      ? { email: consumedBy.email, displayName: displayNameFor(consumedBy) }
      : null,
    consumedAt: invite.consumedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  };
}

export const adminInviteService = {
  async list(): Promise<AdminInviteDto[]> {
    const invites = await adminInviteRepo.listAll();
    const userIds = Array.from(
      new Set(
        invites
          .flatMap((i) => [i.invitedById, i.consumedById])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return invites.map((i) => toDto(i, userMap));
  },

  async create(
    actor: { id: string; email: string },
    dto: CreateAdminInviteDto,
  ): Promise<AdminInviteDto> {
    const email = dto.email.toLowerCase();

    // Reject if the email already belongs to a registered user. Lets the
    // operator know they don't need an invite (the user is already in the DB).
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError(
        existingUser.role === 'admin'
          ? 'Ese correo ya pertenece a un administrador registrado'
          : 'Ese correo ya pertenece a un usuario no-admin',
      );
    }

    const existingInvite = await adminInviteRepo.findByEmail(email);
    if (existingInvite) {
      throw new ConflictError(
        existingInvite.status === 'pending'
          ? 'Ya existe una invitación pendiente para ese correo'
          : existingInvite.status === 'consumed'
            ? 'Ese correo ya fue invitado y consumió la invitación'
            : 'Ese correo fue invitado previamente (revocado)',
      );
    }

    const invite = await adminInviteRepo.create({
      email,
      note: dto.note ?? null,
      invitedById: actor.id,
    });

    await auditService.record({
      action: 'admin.invite.created',
      actor: actor.email,
      target: email,
      payload: { inviteId: invite.id, note: dto.note ?? null },
    });

    return toDto(
      invite,
      new Map([[actor.id, { email: actor.email, firstName: null, lastName: null }]]),
    );
  },

  async revoke(actor: { id: string; email: string }, inviteId: string): Promise<AdminInviteDto> {
    const invite = await adminInviteRepo.findById(inviteId);
    if (!invite) throw new NotFoundError('Invitación');
    if (invite.status === 'consumed') {
      throw new ValidationError('No se puede revocar una invitación ya consumida');
    }
    if (invite.status === 'revoked') return toDto(invite, new Map());

    const updated = await adminInviteRepo.markRevoked(inviteId);
    await auditService.record({
      action: 'admin.invite.revoked',
      actor: actor.email,
      target: invite.email,
      payload: { inviteId: invite.id },
    });
    return toDto(updated, new Map());
  },

  /**
   * Used by the auth register flow. Checks if `email` has a pending admin
   * invite — does NOT mark it consumed (caller does that inside the
   * register transaction to keep both writes atomic).
   */
  async findPendingInviteForEmail(email: string) {
    return adminInviteRepo.findPendingByEmail(email);
  },
};
