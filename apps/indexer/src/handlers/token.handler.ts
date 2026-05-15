import type { TokenDeployedEvent } from '@hack/sdk';
import type { HandlerContext } from './index.js';

export async function handleTokenDeployed(
  event: TokenDeployedEvent,
  ctx: HandlerContext,
): Promise<void> {
  await ctx.prisma.offering.updateMany({
    where: { id: event.offeringId, tokenAddress: null },
    data: { tokenAddress: event.tokenAddress, status: 'active' },
  });
}
