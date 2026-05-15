import { z } from 'zod';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { auditService } from '@/lib/server/services/audit.service';
import { jsonOk } from '@/lib/server/http/response';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().max(80).optional(),
  actor: z.string().max(200).optional(),
});

export const GET = withErrorHandler(
  withRole(['admin'], async (req) => {
    const params = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const result = await auditService.list(params);
    return jsonOk({
      items: result.items.map((e) => ({
        id: e.id,
        action: e.action,
        actor: e.actor,
        target: e.target,
        payload: e.payload,
        txHash: e.txHash,
        createdAt: e.createdAt.toISOString(),
      })),
      total: result.total,
      page: params.page,
      pageSize: params.pageSize,
    });
  }),
);
