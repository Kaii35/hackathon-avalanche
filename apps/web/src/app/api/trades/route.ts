import { z } from 'zod';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { tradeRepo } from '@/lib/server/repositories/trade.repo';
import { jsonOk } from '@/lib/server/http/response';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  offeringId: z.string().uuid().optional(),
  wallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const GET = withErrorHandler(async (req) => {
  const params = QuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await tradeRepo.list({
    page: params.page,
    pageSize: params.pageSize,
    offeringId: params.offeringId,
    wallet: params.wallet,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
  });
  return jsonOk({
    items: items.map((t) => ({
      id: t.id,
      offeringId: t.offeringId,
      offeringName: t.offering.name,
      symbol: t.offering.symbol,
      qty: t.qty.toString(),
      price: t.price.toString(),
      buyer: t.buyOrder.makerWallet,
      seller: t.sellOrder.makerWallet,
      txHash: t.txHash,
      settledAt: t.settledAt.toISOString(),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
  });
});
