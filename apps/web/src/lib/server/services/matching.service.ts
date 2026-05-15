import { Prisma, prisma } from '@hack/database';
import { ConflictError, NotFoundError } from '@hack/shared';
import { offeringRepo } from '../repositories/offering.repo';
import { orderRepo } from '../repositories/order.repo';
import { chainClient } from '../chain/client';
import { auditService } from './audit.service';
import { redis } from '../redis';
import { logger } from '../logger';

export interface MatchResult {
  matched: number;
  trades: Array<{ id: string; qty: string; price: string; txHash: string }>;
}

export const matchingService = {
  async runForOffering(offeringId: string): Promise<MatchResult> {
    const offering = await offeringRepo.findById(offeringId);
    if (!offering) throw new NotFoundError('Oferta');
    if (!offering.tokenAddress) throw new ConflictError('Oferta sin token desplegado');

    const orders = await orderRepo.findOpenByOffering(offeringId);
    const buys = orders
      .filter((o) => o.side === 'buy')
      .sort(
        (a, b) =>
          Number(b.price) - Number(a.price) || a.createdAt.getTime() - b.createdAt.getTime(),
      );
    const sells = orders
      .filter((o) => o.side === 'sell')
      .sort(
        (a, b) =>
          Number(a.price) - Number(b.price) || a.createdAt.getTime() - b.createdAt.getTime(),
      );

    const trades: MatchResult['trades'] = [];

    for (const buy of buys) {
      let buyRemaining = Number(buy.qty) - Number(buy.filledQty);
      if (buyRemaining <= 0) continue;

      for (const sell of sells) {
        if (buyRemaining <= 0) break;
        if (Number(buy.price) < Number(sell.price)) break;
        const sellRemaining = Number(sell.qty) - Number(sell.filledQty);
        if (sellRemaining <= 0) continue;

        const qty = Math.min(buyRemaining, sellRemaining);
        const price = (Number(buy.price) + Number(sell.price)) / 2;

        try {
          const tx = await chainClient.settlement.executeMatch({
            buyOrderHash: buy.orderHash as `0x${string}`,
            sellOrderHash: sell.orderHash as `0x${string}`,
            buyer: buy.makerWallet as `0x${string}`,
            seller: sell.makerWallet as `0x${string}`,
            token: offering.tokenAddress as `0x${string}`,
            qty: BigInt(Math.floor(qty)),
            price: BigInt(Math.floor(price * 100)),
          });

          const trade = await prisma.$transaction(async (tx2) => {
            const newBuyFilled = new Prisma.Decimal(Number(buy.filledQty) + qty);
            const newSellFilled = new Prisma.Decimal(Number(sell.filledQty) + qty);
            await tx2.order.update({
              where: { id: buy.id },
              data: {
                filledQty: newBuyFilled,
                status: newBuyFilled.gte(buy.qty) ? 'filled' : 'partial',
              },
            });
            await tx2.order.update({
              where: { id: sell.id },
              data: {
                filledQty: newSellFilled,
                status: newSellFilled.gte(sell.qty) ? 'filled' : 'partial',
              },
            });
            return tx2.trade.create({
              data: {
                buyOrderId: buy.id,
                sellOrderId: sell.id,
                offeringId,
                qty: new Prisma.Decimal(qty),
                price: new Prisma.Decimal(price),
                txHash: tx.txHash,
                blockNumber: tx.blockNumber,
              },
            });
          });

          await auditService.record({
            action: 'trade.settled',
            actor: 'matching-engine',
            target: trade.id,
            payload: { offeringId, qty, price },
            txHash: tx.txHash,
          });

          buy.filledQty = new Prisma.Decimal(Number(buy.filledQty) + qty);
          sell.filledQty = new Prisma.Decimal(Number(sell.filledQty) + qty);
          buyRemaining -= qty;

          trades.push({
            id: trade.id,
            qty: qty.toString(),
            price: price.toString(),
            txHash: tx.txHash,
          });
        } catch (err) {
          logger.warn({ err, buyId: buy.id, sellId: sell.id }, 'match failed; continuing');
        }
      }
    }

    if (trades.length > 0) await redis.del(`book:${offeringId}`);
    return { matched: trades.length, trades };
  },
};
