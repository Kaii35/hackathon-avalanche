import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { orderService } from '@/lib/server/services/order.service';
import { jsonOk } from '@/lib/server/http/response';

export const DELETE = withErrorHandler(
  withAuth<{ id: string }>(async (_req, ctx) => {
    const result = await orderService.cancel(ctx.user.sub, ctx.params.id);
    return jsonOk(result);
  }),
);
