import { prisma, Prisma } from '@hack/database';

export interface ListOfferingsParams {
  page: number;
  pageSize: number;
  status?: 'draft' | 'active' | 'closed';
  issuerId?: string;
  search?: string;
}

export const offeringRepo = {
  async list(params: ListOfferingsParams) {
    const where: Prisma.OfferingWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.issuerId) where.issuerId = params.issuerId;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { symbol: { contains: params.search, mode: 'insensitive' } },
        { sector: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await Promise.all([
      prisma.offering.count({ where }),
      prisma.offering.findMany({
        where,
        include: { issuer: { select: { name: true, kycIssuerAddress: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { total, items };
  },

  async findById(id: string) {
    return prisma.offering.findUnique({
      where: { id },
      include: { issuer: true },
    });
  },

  async create(data: Prisma.OfferingCreateInput) {
    return prisma.offering.create({ data });
  },

  async setTokenAddress(id: string, tokenAddress: string, status: 'active' | 'closed' = 'active') {
    return prisma.offering.update({
      where: { id },
      data: { tokenAddress: tokenAddress.toLowerCase(), status },
    });
  },

  async capTable(offeringId: string) {
    return prisma.capTableEntry.findMany({
      where: { offeringId },
      orderBy: { balance: 'desc' },
    });
  },
};
