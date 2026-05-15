import type { ForcedTransferEvent } from '@hack/sdk';
import type { HandlerContext } from './index.js';

export async function handleForcedTransfer(
  event: ForcedTransferEvent,
  ctx: HandlerContext,
): Promise<void> {
  await ctx.prisma.auditLog.create({
    data: {
      action: 'forced_transfer.observed',
      actor: 'indexer',
      target: event.from,
      payload: { to: event.to, value: event.value, reason: event.reason },
      txHash: event.txHash,
    },
  });
}
