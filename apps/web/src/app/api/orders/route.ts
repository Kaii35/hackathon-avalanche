import { CreateOrderSchema, RATE_LIMITS } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { enforceRateLimit } from '@/lib/server/middleware/withRateLimit';
import { orderService } from '@/lib/server/services/order.service';
import { jsonCreated, parseJson } from '@/lib/server/http/response';

export const POST = withErrorHandler(
  withAuth(async (req, ctx) => {
    const body = await parseJson<{ maker?: string }>(req);
    await enforceRateLimit(req, {
      bucket: 'orders',
      points: RATE_LIMITS.orders.points,
      durationSec: RATE_LIMITS.orders.durationSec,
      keyFromReq: () => (body.maker ?? ctx.user.sub).toLowerCase(),
    });
    const dto = CreateOrderSchema.parse(body);
    const order = await orderService.create(ctx.user.sub, dto);
    return jsonCreated(order);
  }),
);
