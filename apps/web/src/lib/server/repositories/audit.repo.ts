import { prisma, Prisma } from '@hack/database';

export const auditRepo = {
  async write(entry: {
    action: string;
    actor: string;
    target?: string | null;
    payload: Prisma.InputJsonValue;
    txHash?: string | null;
  }) {
    return prisma.auditLog.create({
      data: {
        action: entry.action,
        actor: entry.actor,
        target: entry.target ?? null,
        payload: entry.payload,
        txHash: entry.txHash ?? null,
      },
    });
  },

  async list(params: { page: number; pageSize: number; action?: string; actor?: string }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.actor) where.actor = params.actor;
    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { total, items };
  },
};
