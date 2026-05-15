import type {
  IdentityRegisteredEvent,
  IdentityRemovedEvent,
  WalletFrozenEvent,
  WalletUnfrozenEvent,
} from '@hack/sdk';
import type { HandlerContext } from './index.js';

export async function handleIdentityEvent(
  event: IdentityRegisteredEvent | IdentityRemovedEvent,
  ctx: HandlerContext,
): Promise<void> {
  if (event.type === 'IdentityRemoved') {
    await ctx.prisma.identity.updateMany({
      where: { wallet: event.wallet },
      data: { kycStatus: 'rejected' },
    });
    return;
  }
  await ctx.prisma.identity.updateMany({
    where: { wallet: event.wallet },
    data: {
      kycStatus: 'verified',
      jurisdiction: event.jurisdiction,
      accredited: event.accredited,
      claimHash: event.claimHash,
      verifiedAt: new Date(),
    },
  });
}

export async function handleFreezeEvent(
  event: WalletFrozenEvent | WalletUnfrozenEvent,
  ctx: HandlerContext,
): Promise<void> {
  const frozen = event.type === 'WalletFrozen';
  await ctx.prisma.identity.updateMany({
    where: { wallet: event.wallet },
    data: { frozen },
  });
  if (frozen) {
    await ctx.prisma.auditLog.create({
      data: {
        action: 'wallet.frozen.observed',
        actor: 'indexer',
        target: event.wallet,
        payload: { reason: event.reason },
        txHash: event.txHash,
      },
    });
  }
}
