import type { TradeExecutedEvent } from '@hack/sdk';
import type { HandlerContext } from './index.js';

export async function handleTradeExecuted(
  event: TradeExecutedEvent,
  ctx: HandlerContext,
): Promise<void> {
  const existing = await ctx.prisma.trade.findUnique({ where: { txHash: event.txHash } });
  if (existing) return;
  ctx.logger.info(
    { txHash: event.txHash },
    'trade event observed; matcher already persisted in service tier',
  );
}
