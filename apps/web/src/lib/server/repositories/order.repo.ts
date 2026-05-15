import { prisma, Prisma } from '@hack/database';

export const orderRepo = {
  async create(data: Prisma.OrderCreateInput) {
    return prisma.order.create({ data });
  },

  async findById(id: string) {
    return prisma.order.findUnique({ where: { id } });
  },

  async findOpenByOffering(offeringId: string) {
    return prisma.order.findMany({
      where: { offeringId, status: { in: ['open', 'partial'] } },
      orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async cancelByMaker(id: string, makerWallet: string) {
    return prisma.order.updateMany({
      where: { id, makerWallet, status: { in: ['open', 'partial'] } },
      data: { status: 'cancelled' },
    });
  },

  async markFilled(id: string, filledQty: Prisma.Decimal, status: 'filled' | 'partial') {
    return prisma.order.update({ where: { id }, data: { filledQty, status } });
  },
};
