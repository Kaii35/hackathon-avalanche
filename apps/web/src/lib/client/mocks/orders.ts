import type { OrderResponseDto, OrderbookResponseDto } from '@hack/shared';

function buildBook(
  mid: number,
  spread = 0.4,
  depth = 10,
): { bids: OrderbookResponseDto['bids']; asks: OrderbookResponseDto['asks'] } {
  const bids = Array.from({ length: depth }).map((_, i) => {
    const price = (mid - spread - i * 0.18 + Math.random() * 0.04).toFixed(2);
    const qty = (300 + Math.random() * 1500 + i * 80).toFixed(0);
    return { price, qty, orderCount: 1 + Math.floor(Math.random() * 5) };
  });
  const asks = Array.from({ length: depth }).map((_, i) => {
    const price = (mid + spread + i * 0.2 + Math.random() * 0.05).toFixed(2);
    const qty = (300 + Math.random() * 1300 + i * 70).toFixed(0);
    return { price, qty, orderCount: 1 + Math.floor(Math.random() * 5) };
  });
  return { bids, asks };
}

export function makeOrderbook(offeringId: string, mid: number): OrderbookResponseDto {
  const { bids, asks } = buildBook(mid);
  return {
    offeringId,
    bids,
    asks,
    lastTradePrice: mid.toFixed(2),
    updatedAt: new Date().toISOString(),
  };
}

export const MOCK_OPEN_ORDERS: OrderResponseDto[] = [
  {
    id: 'o1111111-1111-1111-1111-111111111111',
    orderHash: '0xabc1230000000000000000000000000000000000000000000000000000000001',
    offeringId: '11111111-1111-1111-1111-111111111111',
    maker: '0x7421ef02bcde8f192b91234567890abcdef12345',
    side: 'buy',
    qty: '500',
    price: '102.20',
    filledQty: '0',
    status: 'open',
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600_000 * 4).toISOString(),
  },
  {
    id: 'o2222222-2222-2222-2222-222222222222',
    orderHash: '0xabc1230000000000000000000000000000000000000000000000000000000002',
    offeringId: '33333333-3333-3333-3333-333333333333',
    maker: '0x7421ef02bcde8f192b91234567890abcdef12345',
    side: 'sell',
    qty: '200',
    price: '109.50',
    filledQty: '50',
    status: 'partial',
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    createdAt: new Date(Date.now() - 3600_000 * 8).toISOString(),
  },
];

export const MOCK_FILLED_ORDERS: OrderResponseDto[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `f${i}-1111-1111-1111-111111111111`,
  orderHash: `0xfff${i}0000000000000000000000000000000000000000000000000000000000`,
  offeringId:
    i % 2 === 0 ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222',
  maker: '0x7421ef02bcde8f192b91234567890abcdef12345',
  side: i % 2 === 0 ? 'buy' : 'sell',
  qty: (200 + i * 80).toString(),
  price: (100 + Math.sin(i) * 2.5).toFixed(2),
  filledQty: (200 + i * 80).toString(),
  status: 'filled',
  expiresAt: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
  createdAt: new Date(Date.now() - 86400000 * (i + 1) - 3600_000).toISOString(),
}));
