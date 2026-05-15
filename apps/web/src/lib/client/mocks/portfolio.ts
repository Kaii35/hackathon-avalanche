import type { PortfolioResponseDto } from '@hack/shared';

export const MOCK_WALLET = '0x7421ef02bcde8f192b91234567890abcdef12345' as const;

export const MOCK_PORTFOLIO: PortfolioResponseDto = {
  wallet: MOCK_WALLET,
  positions: [
    {
      offeringId: '11111111-1111-1111-1111-111111111111',
      offeringName: 'Crédito PYME Series A',
      symbol: 'AKAPYM',
      balance: '12500',
      pricePerUnit: '102.40',
      marketValue: '1280000.00',
      percentOfOffering: 0.025,
    },
    {
      offeringId: '33333333-3333-3333-3333-333333333333',
      offeringName: 'Renta Industrial Bajío',
      symbol: 'BORENT',
      balance: '4200',
      pricePerUnit: '108.80',
      marketValue: '456960.00',
      percentOfOffering: 0.014,
    },
    {
      offeringId: '22222222-2222-2222-2222-222222222222',
      offeringName: 'Agro-Renovables MX',
      symbol: 'CVAGRO',
      balance: '8000',
      pricePerUnit: '95.10',
      marketValue: '760800.00',
      percentOfOffering: 0.04,
    },
    {
      offeringId: '44444444-4444-4444-4444-444444444444',
      offeringName: 'Fondo SaaS LATAM I',
      symbol: 'TVSAAS',
      balance: '1100',
      pricePerUnit: '142.50',
      marketValue: '156750.00',
      percentOfOffering: 0.011,
    },
  ],
  totalMarketValue: '2654510.00',
  asOf: new Date().toISOString(),
};

export const MOCK_PORTFOLIO_HISTORY: Array<{ ts: string; value: number }> = Array.from({
  length: 90,
}).map((_, i) => {
  const base = 2_100_000;
  const trend = i * 6500;
  const wave = Math.sin(i / 6) * 35000 + Math.cos(i / 11) * 22000;
  return {
    ts: new Date(Date.now() - (89 - i) * 86400000).toISOString(),
    value: Math.round(base + trend + wave),
  };
});
