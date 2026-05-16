import type { PortfolioResponseDto } from '@hack/shared';

export const MOCK_WALLET = '0x7421ef02bcde8f192b91234567890abcdef12345' as const;

const OFFERING_CATALOG: Array<{
  offeringId: string;
  offeringName: string;
  symbol: string;
  pricePerUnit: number;
}> = [
  {
    offeringId: '11111111-1111-1111-1111-111111111111',
    offeringName: 'Crédito PYME Series A',
    symbol: 'AKAPYM',
    pricePerUnit: 102.4,
  },
  {
    offeringId: '22222222-2222-2222-2222-222222222222',
    offeringName: 'Agro-Renovables MX',
    symbol: 'CVAGRO',
    pricePerUnit: 95.1,
  },
  {
    offeringId: '33333333-3333-3333-3333-333333333333',
    offeringName: 'Renta Industrial Bajío',
    symbol: 'BORENT',
    pricePerUnit: 108.8,
  },
  {
    offeringId: '44444444-4444-4444-4444-444444444444',
    offeringName: 'Fondo SaaS LATAM I',
    symbol: 'TVSAAS',
    pricePerUnit: 142.5,
  },
  {
    offeringId: '55555555-5555-5555-5555-555555555555',
    offeringName: 'Logística MX Norte',
    symbol: 'LOGNTE',
    pricePerUnit: 88.6,
  },
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

/**
 * Builds a deterministic mock portfolio for a given wallet.
 * Same wallet → same portfolio every render. Different wallets → different portfolios.
 * (Until the real ERC-3643 contracts ship, this is the closest we can get to "real per wallet".)
 */
export function getMockPortfolio(wallet: string): PortfolioResponseDto {
  const seed = fnv1a(wallet.toLowerCase());
  const rand = mulberry32(seed);
  const positionCount = 2 + Math.floor(rand() * 3); // 2..4 positions
  const shuffled = [...OFFERING_CATALOG].sort(() => rand() - 0.5).slice(0, positionCount);

  const positions = shuffled.map((o) => {
    const balance = Math.round(500 + rand() * 14_500); // 500..15,000 units
    const priceJitter = 1 + (rand() - 0.5) * 0.04; // ±2%
    const pricePerUnit = +(o.pricePerUnit * priceJitter).toFixed(2);
    const marketValue = +(balance * pricePerUnit).toFixed(2);
    return {
      offeringId: o.offeringId,
      offeringName: o.offeringName,
      symbol: o.symbol,
      balance: balance.toString(),
      pricePerUnit: pricePerUnit.toFixed(2),
      marketValue: marketValue.toFixed(2),
      percentOfOffering: +(0.005 + rand() * 0.045).toFixed(4), // 0.5..5%
    };
  });

  const totalMarketValue = positions.reduce((acc, p) => acc + Number(p.marketValue), 0).toFixed(2);

  return {
    wallet: wallet as `0x${string}`,
    positions,
    totalMarketValue,
    asOf: new Date().toISOString(),
  };
}

/**
 * Builds a deterministic 90-day portfolio history seeded from wallet.
 * The terminal value matches the totalMarketValue from getMockPortfolio.
 */
export function getMockPortfolioHistory(wallet: string): Array<{ ts: string; value: number }> {
  const seed = fnv1a(wallet.toLowerCase()) ^ 0xa5a5a5a5;
  const rand = mulberry32(seed);
  const portfolio = getMockPortfolio(wallet);
  const target = Number(portfolio.totalMarketValue);
  const start = target * (0.78 + rand() * 0.1); // start 78–88% of current
  const slope = (target - start) / 89;

  return Array.from({ length: 90 }).map((_, i) => {
    const trend = start + slope * i;
    const wave = Math.sin(i / 6 + rand() * 6) * (target * 0.015);
    const noise = (rand() - 0.5) * (target * 0.012);
    return {
      ts: new Date(Date.now() - (89 - i) * 86400000).toISOString(),
      value: Math.max(0, Math.round(trend + wave + noise)),
    };
  });
}

// Backwards-compatible exports for code that hasn't migrated to wallet-aware mocks yet.
export const MOCK_PORTFOLIO: PortfolioResponseDto = getMockPortfolio(MOCK_WALLET);
export const MOCK_PORTFOLIO_HISTORY = getMockPortfolioHistory(MOCK_WALLET);
