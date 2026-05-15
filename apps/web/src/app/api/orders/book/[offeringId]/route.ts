import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { orderService } from '@/lib/server/services/order.service';
import { jsonOk } from '@/lib/server/http/response';

export const GET = withErrorHandler<{ params: Promise<{ offeringId: string }> }>(
  async (_req, ctx) => {
    const { offeringId } = await ctx.params;
    const book = await orderService.book(offeringId);
    return jsonOk(book);
  },
);
