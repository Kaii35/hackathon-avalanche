export type ActivityKind =
  | 'kyc_verified'
  | 'order_filled'
  | 'order_created'
  | 'order_cancelled'
  | 'wallet_frozen'
  | 'forced_transfer'
  | 'offering_active'
  | 'token_received';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  description: string;
  ts: string;
  amount?: string;
  symbol?: string;
}

export const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: 'a1',
    kind: 'order_filled',
    title: 'Orden ejecutada',
    description: 'Tu orden de compra de 500 AKAPYM se ejecutó al precio de 102.40 USDC.',
    ts: new Date(Date.now() - 3600_000 * 1.5).toISOString(),
    amount: '500',
    symbol: 'AKAPYM',
  },
  {
    id: 'a2',
    kind: 'offering_active',
    title: 'Nueva oferta disponible',
    description: 'Hub Logístico Manzanillo (MARZNLO) abrió suscripción primaria.',
    ts: new Date(Date.now() - 3600_000 * 6).toISOString(),
  },
  {
    id: 'a3',
    kind: 'token_received',
    title: 'Tokens recibidos',
    description: 'Recibiste 1,200 BORENT por settlement de orden #f3-1111.',
    ts: new Date(Date.now() - 3600_000 * 12).toISOString(),
    amount: '1200',
    symbol: 'BORENT',
  },
  {
    id: 'a4',
    kind: 'order_created',
    title: 'Orden firmada',
    description: 'Creaste una orden de venta de 200 CVAGRO @ 95.40 USDC.',
    ts: new Date(Date.now() - 86400_000).toISOString(),
    amount: '200',
    symbol: 'CVAGRO',
  },
  {
    id: 'a5',
    kind: 'kyc_verified',
    title: 'KYC verificado',
    description: 'Tu identidad fue verificada por Arkangeles ClaimIssuer (jurisdicción MX).',
    ts: new Date(Date.now() - 86400_000 * 12).toISOString(),
  },
];
