import type { OrderResponseDto, OrderbookResponseDto } from '@hack/shared';

const OFFERINGS_FOR_ORDERS: Array<{ id: string; symbol: string; basePrice: number }> = [
  { id: '11111111-1111-1111-1111-111111111111', symbol: 'AKAPYM', basePrice: 102.4 },
  { id: '22222222-2222-2222-2222-222222222222', symbol: 'CVAGRO', basePrice: 95.1 },
  { id: '33333333-3333-3333-3333-333333333333', symbol: 'BORENT', basePrice: 108.8 },
  { id: '44444444-4444-4444-4444-444444444444', symbol: 'TVSAAS', basePrice: 142.5 },
  { id: '55555555-5555-5555-5555-555555555555', symbol: 'LOGNTE', basePrice: 88.6 },
];

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicHex(rand: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(rand() * 16).toString(16);
  }
  return out;
}

function buildBook(
  mid: number,
  spread = 0.4,
  depth = 10,
): { bids: OrderbookResponseDto['bids']; asks: OrderbookResponseDto['asks'] } {
  // Orderbook stays random per tick — represents the live market, not user-specific.
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

/**
 * Build a deterministic set of OPEN orders for a given wallet.
 * Same wallet → same orders. Different wallets → different orders.
 */
export function getMockOpenOrders(wallet: string): OrderResponseDto[] {
  const seed = fnv1a(wallet.toLowerCase()) ^ 0x10101010;
  const rand = mulberry32(seed);
  const count = Math.floor(rand() * 3); // 0..2 open orders
  return Array.from({ length: count }).map((_, i) => {
    const offering = OFFERINGS_FOR_ORDERS[Math.floor(rand() * OFFERINGS_FOR_ORDERS.length)]!;
    const side: 'buy' | 'sell' = rand() < 0.5 ? 'buy' : 'sell';
    const qty = Math.round(100 + rand() * 900);
    const priceJitter = 1 + (rand() - 0.5) * 0.04;
    const price = +(offering.basePrice * priceJitter).toFixed(2);
    const filledQty = i === 0 && rand() < 0.4 ? Math.round(qty * 0.25) : 0;
    return {
      id: `o-${wallet.slice(2, 6)}-${i}-1111-1111-${deterministicHex(rand, 12)}`,
      orderHash: `0x${deterministicHex(rand, 64)}` as `0x${string}`,
      offeringId: offering.id,
      maker: wallet as `0x${string}`,
      side,
      qty: qty.toString(),
      price: price.toFixed(2),
      filledQty: filledQty.toString(),
      status: filledQty > 0 ? ('partial' as const) : ('open' as const),
      expiresAt: new Date(Date.now() + 86400_000 * (2 + rand() * 5)).toISOString(),
      createdAt: new Date(Date.now() - 3600_000 * (1 + rand() * 12)).toISOString(),
    };
  });
}

/**
 * Build a deterministic set of FILLED orders (history) for a given wallet.
 */
export function getMockFilledOrders(wallet: string): OrderResponseDto[] {
  const seed = fnv1a(wallet.toLowerCase()) ^ 0x20202020;
  const rand = mulberry32(seed);
  const count = 4 + Math.floor(rand() * 6); // 4..9 historic fills
  return Array.from({ length: count }).map((_, i) => {
    const offering = OFFERINGS_FOR_ORDERS[Math.floor(rand() * OFFERINGS_FOR_ORDERS.length)]!;
    const side: 'buy' | 'sell' = rand() < 0.5 ? 'buy' : 'sell';
    const qty = Math.round(100 + rand() * 900);
    const priceJitter = 1 + (rand() - 0.5) * 0.05;
    const price = +(offering.basePrice * priceJitter).toFixed(2);
    return {
      id: `f-${wallet.slice(2, 6)}-${i}-1111-1111-${deterministicHex(rand, 12)}`,
      orderHash: `0x${deterministicHex(rand, 64)}` as `0x${string}`,
      offeringId: offering.id,
      maker: wallet as `0x${string}`,
      side,
      qty: qty.toString(),
      price: price.toFixed(2),
      filledQty: qty.toString(),
      status: 'filled' as const,
      expiresAt: new Date(Date.now() - 86400_000 * (i + 1)).toISOString(),
      createdAt: new Date(Date.now() - 86400_000 * (i + 1) - 3600_000).toISOString(),
    };
  });
}

// Backwards-compat exports for any code still importing the constants. Empty so the
// developer can immediately tell something is misconfigured if they get rendered.
export const MOCK_OPEN_ORDERS: OrderResponseDto[] = [];
export const MOCK_FILLED_ORDERS: OrderResponseDto[] = [];
