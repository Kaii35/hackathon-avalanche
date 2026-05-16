import { Prisma, prisma } from '@hack/database';
import type { OrderResponseDto } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { jsonOk } from '@/lib/server/http/response';

// Response shape: standard order DTO + lastTradeTxHash (on-chain TX that
// settled this order, when applicable). The TX hash is what the user can
// search in Snowscan; the order hash lives only in event topics.
export interface MyOrderResponseDto extends OrderResponseDto {
  lastTradeTxHash: `0x${string}` | null;
}

export const GET = withErrorHandler(
  withAuth(async (req, ctx) => {
    const statusParam = new URL(req.url).searchParams.get('status');
    const status: 'open' | 'filled' | 'all' =
      statusParam === 'open' || statusParam === 'filled' ? statusParam : 'all';

    // Fetch all wallets owned by the authenticated user; match orders by any
    // of those addresses (case-insensitive). User may have several wallets.
    const wallets = await prisma.wallet.findMany({
      where: { userId: ctx.user.sub },
      select: { address: true },
    });
    if (wallets.length === 0) return jsonOk([] as MyOrderResponseDto[]);

    const addressList = wallets.map((w) => w.address.toLowerCase());

    const where: Prisma.OrderWhereInput = { makerWallet: { in: addressList } };
    if (status === 'open') where.status = { in: ['open', 'partial'] };
    if (status === 'filled') where.status = 'filled';

    // Pull orders + their related trades (as buy or sell). For each filled/partial
    // order we surface the txHash of the most recent settlement trade.
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        buyTrades: { orderBy: { settledAt: 'desc' }, take: 1 },
        sellTrades: { orderBy: { settledAt: 'desc' }, take: 1 },
      },
    });

    const result: MyOrderResponseDto[] = orders.map((o) => {
      const trade = o.buyTrades[0] ?? o.sellTrades[0] ?? null;
      return {
        id: o.id,
        orderHash: o.orderHash as `0x${string}`,
        offeringId: o.offeringId,
        maker: o.makerWallet as `0x${string}`,
        side: o.side as 'buy' | 'sell',
        qty: o.qty.toString(),
        price: o.price.toString(),
        filledQty: o.filledQty.toString(),
        status: o.status as 'open' | 'partial' | 'filled' | 'cancelled' | 'expired',
        expiresAt: o.expiresAt.toISOString(),
        createdAt: o.createdAt.toISOString(),
        lastTradeTxHash: (trade?.txHash as `0x${string}` | undefined) ?? null,
      };
    });

    return jsonOk(result);
  }),
);
