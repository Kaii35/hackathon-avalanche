import { prisma } from '@hack/database';

export const userRepo = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        wallets: { orderBy: { isPrimary: 'desc' } },
        identities: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        wallets: { orderBy: { isPrimary: 'desc' } },
        identities: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  },

  async create(data: {
    email: string;
    passwordHash: string;
    role: 'investor' | 'issuer' | 'admin';
    firstName: string;
    lastName: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  },

  async linkWallet(userId: string, address: string) {
    const lower = address.toLowerCase();
    return prisma.$transaction(async (tx) => {
      const existing = await tx.wallet.findUnique({ where: { address: lower } });
      if (existing && existing.userId !== userId) {
        throw new Error('wallet ya vinculada a otra cuenta');
      }
      const hasPrimary = await tx.wallet.findFirst({ where: { userId, isPrimary: true } });
      return tx.wallet.upsert({
        where: { address: lower },
        create: { userId, address: lower, isPrimary: !hasPrimary },
        update: {},
      });
    });
  },
};
