import type { Prisma } from '@hack/database';
import { auditRepo } from '../repositories/audit.repo';

export const auditService = {
  async record(entry: {
    action: string;
    actor: string;
    target?: string | null;
    payload: Prisma.InputJsonValue;
    txHash?: string | null;
  }) {
    return auditRepo.write(entry);
  },

  async list(params: { page: number; pageSize: number; action?: string; actor?: string }) {
    return auditRepo.list(params);
  },
};
