import { prisma, Prisma } from '@hack/database';

export interface ListTradesParams {
  offeringId?: string;
  wallet?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export const tradeRepo = {
  async list(params: ListTradesParams) {
    const where: Prisma.TradeWhereInput = {};
    if (params.offeringId) where.offeringId = params.offeringId;
    if (params.from || params.to) {
      where.settledAt = {};
      if (params.from) where.settledAt.gte = params.from;
      if (params.to) where.settledAt.lte = params.to;
    }
    if (params.wallet) {
      const lower = params.wallet.toLowerCase();
      where.OR = [{ buyOrder: { makerWallet: lower } }, { sellOrder: { makerWallet: lower } }];
    }
    const [total, items] = await Promise.all([
      prisma.trade.count({ where }),
      prisma.trade.findMany({
        where,
        include: {
          offering: { select: { name: true, symbol: true } },
          buyOrder: { select: { makerWallet: true } },
          sellOrder: { select: { makerWallet: true } },
        },
        orderBy: { settledAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { total, items };
  },

  async lastPriceByOffering(offeringId: string) {
    const t = await prisma.trade.findFirst({
      where: { offeringId },
      orderBy: { settledAt: 'desc' },
      select: { price: true },
    });
    return t?.price ?? null;
  },
};
