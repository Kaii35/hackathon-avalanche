import { Prisma, prisma } from '@hack/database';
import { ConflictError, NotFoundError } from '@hack/shared';
import { parseUnits, type Address, type Hex } from 'viem';
import type { SettlementOrder } from '@hack/sdk';
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

    const paymentToken = (process.env.NEXT_PUBLIC_USDC ??
      '0x0000000000000000000000000000000000000002') as Address;

    // Canonical scaling — same parseUnits calls as order.service and the frontend.
    // DB stores pretty values; we convert to base units only at settlement time.
    const TOKEN_DECIMALS = 18;
    const USDC_DECIMALS = 6;

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
          // Build SettlementOrder tuples with base units — pass-through to adapter.
          // parseUnits mirrors what the wallet signed at order creation time.
          const buyOrder: SettlementOrder = {
            maker: buy.makerWallet as Address,
            token: offering.tokenAddress as Address,
            paymentToken,
            side: 0 as const,
            qty: parseUnits(buy.qty.toString(), TOKEN_DECIMALS),
            price: parseUnits(buy.price.toString(), USDC_DECIMALS),
            expiresAt: BigInt(Math.floor(buy.expiresAt.getTime() / 1000)),
            salt: BigInt(buy.salt),
          };

          const sellOrder: SettlementOrder = {
            maker: sell.makerWallet as Address,
            token: offering.tokenAddress as Address,
            paymentToken,
            side: 1 as const,
            qty: parseUnits(sell.qty.toString(), TOKEN_DECIMALS),
            price: parseUnits(sell.price.toString(), USDC_DECIMALS),
            expiresAt: BigInt(Math.floor(sell.expiresAt.getTime() / 1000)),
            salt: BigInt(sell.salt),
          };

          const fillQty = parseUnits(qty.toString(), TOKEN_DECIMALS);

          const tx = await chainClient.settlement.executeMatch({
            buyOrderHash: buy.orderHash as `0x${string}`,
            sellOrderHash: sell.orderHash as `0x${string}`,
            buyer: buy.makerWallet as `0x${string}`,
            seller: sell.makerWallet as `0x${string}`,
            token: offering.tokenAddress as `0x${string}`,
            qty: fillQty,
            price: buyOrder.price, // legacy compat — adapter is pass-through
            // Full order tuples + signatures for on-chain EIP-712 verification
            buyOrder,
            buySignature: buy.signature as Hex,
            sellOrder,
            sellSignature: sell.signature as Hex,
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

          logger.info(
            { txHash: tx.txHash, blockNumber: tx.blockNumber.toString(), offeringId, qty, price },
            'trade settled on-chain',
          );

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
