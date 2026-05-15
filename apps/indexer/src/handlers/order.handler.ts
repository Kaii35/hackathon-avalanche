import type { OrderCancelledEvent, OrderFilledEvent, OrderPostedEvent } from '@hack/sdk';
import { Prisma } from '@hack/database';
import type { HandlerContext } from './index.js';

type OrderEvent = OrderPostedEvent | OrderCancelledEvent | OrderFilledEvent;

export async function handleOrderEvent(event: OrderEvent, ctx: HandlerContext): Promise<void> {
  const order = await ctx.prisma.order.findUnique({ where: { orderHash: event.orderHash } });
  if (!order) {
    ctx.logger.warn(
      { orderHash: event.orderHash, type: event.type },
      'order event for unknown order',
    );
    return;
  }
  if (event.type === 'OrderCancelled') {
    if (order.status === 'open' || order.status === 'partial') {
      await ctx.prisma.order.update({ where: { id: order.id }, data: { status: 'cancelled' } });
    }
    return;
  }
  if (event.type === 'OrderFilled') {
    const filled = new Prisma.Decimal(event.filledQty);
    await ctx.prisma.order.update({
      where: { id: order.id },
      data: {
        filledQty: filled,
        status: filled.gte(order.qty) ? 'filled' : 'partial',
      },
    });
  }
}
