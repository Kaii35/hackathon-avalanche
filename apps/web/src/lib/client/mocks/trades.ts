export interface MockTrade {
  id: string;
  offeringId: string;
  offeringName: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: string;
  price: string;
  total: string;
  txHash: `0x${string}`;
  settledAt: string;
  counterparty: `0x${string}`;
}

const offeringMap: Record<string, { name: string; symbol: string }> = {
  '11111111-1111-1111-1111-111111111111': { name: 'Crédito PYME Series A', symbol: 'AKAPYM' },
  '22222222-2222-2222-2222-222222222222': { name: 'Agro-Renovables MX', symbol: 'CVAGRO' },
  '33333333-3333-3333-3333-333333333333': { name: 'Renta Industrial Bajío', symbol: 'BORENT' },
  '44444444-4444-4444-4444-444444444444': { name: 'Fondo SaaS LATAM I', symbol: 'TVSAAS' },
  '55555555-5555-5555-5555-555555555555': { name: 'Logística MX Norte', symbol: 'LOGNTE' },
};

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

function detHex(rand: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(rand() * 16).toString(16);
  }
  return out;
}

/**
 * Build a deterministic trade history for a given wallet.
 * Same wallet → same history. Different wallets → different histories.
 */
export function getMockTrades(wallet: string): MockTrade[] {
  const seed = fnv1a(wallet.toLowerCase()) ^ 0x30303030;
  const rand = mulberry32(seed);
  const ids = Object.keys(offeringMap);
  const count = 6 + Math.floor(rand() * 10); // 6..15 trades
  return Array.from({ length: count }).map((_, i) => {
    const offeringId = ids[Math.floor(rand() * ids.length)] ?? ids[0]!;
    const meta = offeringMap[offeringId]!;
    const qty = Math.round(50 + rand() * 850);
    const price = +(95 + (rand() - 0.5) * 16).toFixed(2);
    const counterpartySeed = (seed + i * 0x9e3779b1) >>> 0;
    const counterRand = mulberry32(counterpartySeed);
    return {
      id: `t-${wallet.slice(2, 6)}-${i}-${detHex(rand, 12)}`,
      offeringId,
      offeringName: meta.name,
      symbol: meta.symbol,
      side: rand() < 0.45 ? 'buy' : 'sell',
      qty: qty.toString(),
      price: price.toFixed(2),
      total: (qty * price).toFixed(2),
      txHash: `0x${detHex(rand, 64)}` as `0x${string}`,
      settledAt: new Date(Date.now() - i * 3600_000 * 6 - rand() * 3600_000 * 12).toISOString(),
      counterparty: `0x${detHex(counterRand, 40)}` as `0x${string}`,
    };
  });
}

// Empty placeholder for any old import sites.
export const MOCK_TRADES: MockTrade[] = [];
