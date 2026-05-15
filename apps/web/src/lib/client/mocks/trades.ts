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
};

export const MOCK_TRADES: MockTrade[] = Array.from({ length: 14 }).map((_, i) => {
  const ids = Object.keys(offeringMap);
  const offeringId = ids[i % ids.length] ?? ids[0]!;
  const meta = offeringMap[offeringId]!;
  const qty = 100 + (i % 5) * 70;
  const price = 99 + Math.sin(i / 2) * 4;
  return {
    id: `t${i}-tttt-1111-1111-111111111111`,
    offeringId,
    offeringName: meta.name,
    symbol: meta.symbol,
    side: i % 3 === 0 ? 'buy' : 'sell',
    qty: qty.toString(),
    price: price.toFixed(2),
    total: (qty * price).toFixed(2),
    txHash:
      `0x${'a1b2c3d4e5f6'.repeat(10).slice(0, 64 - 2)}${i.toString(16).padStart(2, '0')}` as `0x${string}`,
    settledAt: new Date(Date.now() - i * 3600_000 * 6).toISOString(),
    counterparty: `0x${'cafe'.repeat(10)}${i.toString().padStart(0, '0')}`.slice(
      0,
      42,
    ) as `0x${string}`,
  };
});
