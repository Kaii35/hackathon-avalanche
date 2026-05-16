import { prisma } from '@hack/database';

export const adminInviteRepo = {
  async findByEmail(email: string) {
    return prisma.adminInvite.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  async findPendingByEmail(email: string) {
    return prisma.adminInvite.findFirst({
      where: { email: email.toLowerCase(), status: 'pending' },
    });
  },

  async listAll() {
    return prisma.adminInvite.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  },

  async create(data: { email: string; note?: string | null; invitedById: string }) {
    return prisma.adminInvite.create({
      data: {
        email: data.email.toLowerCase(),
        note: data.note ?? null,
        invitedById: data.invitedById,
      },
    });
  },

  async markRevoked(id: string) {
    return prisma.adminInvite.update({
      where: { id },
      data: { status: 'revoked' },
    });
  },

  async findById(id: string) {
    return prisma.adminInvite.findUnique({ where: { id } });
  },
};
