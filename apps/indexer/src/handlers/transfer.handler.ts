import { Prisma } from '@prisma/client';
import type { TransferEvent } from '@hack/sdk';
import type { HandlerContext } from './index.js';

const ZERO = '0x0000000000000000000000000000000000000000';

export async function handleTransfer(event: TransferEvent, ctx: HandlerContext): Promise<void> {
  const offering = await ctx.prisma.offering.findUnique({
    where: { tokenAddress: event.token.toLowerCase() },
    select: { id: true, totalSupply: true },
  });
  if (!offering) {
    ctx.logger.warn({ token: event.token }, 'transfer for unknown token; skipping');
    return;
  }
  const value = new Prisma.Decimal(event.value);

  await ctx.prisma.$transaction(async (tx) => {
    if (event.from !== ZERO) {
      const fromEntry = await tx.capTableEntry.findUnique({
        where: { offeringId_wallet: { offeringId: offering.id, wallet: event.from } },
      });
      if (fromEntry) {
        const newBal = fromEntry.balance.minus(value);
        await tx.capTableEntry.update({
          where: { id: fromEntry.id },
          data: {
            balance: newBal,
            percentOfTotal: offering.totalSupply.gt(0)
              ? newBal.div(offering.totalSupply).mul(100)
              : new Prisma.Decimal(0),
            lastUpdatedBlock: event.blockNumber,
          },
        });
      }
    }
    const toEntry = await tx.capTableEntry.findUnique({
      where: { offeringId_wallet: { offeringId: offering.id, wallet: event.to } },
    });
    const newBal = (toEntry?.balance ?? new Prisma.Decimal(0)).plus(value);
    await tx.capTableEntry.upsert({
      where: { offeringId_wallet: { offeringId: offering.id, wallet: event.to } },
      create: {
        offeringId: offering.id,
        wallet: event.to,
        balance: value,
        percentOfTotal: offering.totalSupply.gt(0)
          ? value.div(offering.totalSupply).mul(100)
          : new Prisma.Decimal(0),
        lastUpdatedBlock: event.blockNumber,
      },
      update: {
        balance: newBal,
        percentOfTotal: offering.totalSupply.gt(0)
          ? newBal.div(offering.totalSupply).mul(100)
          : new Prisma.Decimal(0),
        lastUpdatedBlock: event.blockNumber,
      },
    });
  });
}
