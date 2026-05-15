export const JURISDICTION_US = 840;
export const JURISDICTION_ES = 724;

export const DEFAULT_FEE_BPS = 50;
export const BPS_DENOMINATOR = 10_000;

export const ROLES = ['investor', 'issuer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const KYC_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type KycStatusValue = (typeof KYC_STATUSES)[number];

export const ORDER_STATUSES = ['open', 'partial', 'filled', 'cancelled', 'expired'] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_SIDES = ['buy', 'sell'] as const;
export type OrderSideValue = (typeof ORDER_SIDES)[number];

export const OFFERING_STATUSES = ['draft', 'active', 'closed'] as const;
export type OfferingStatusValue = (typeof OFFERING_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'kyc_verified',
  'order_filled',
  'order_cancelled',
  'wallet_frozen',
  'forced_transfer',
  'offering_active',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export const SIWE_DOMAIN = 'mercado-ifc.local';
export const SIWE_STATEMENT =
  'Vincula esta wallet con tu cuenta del Mercado Secundario IFC. Esta firma no autoriza ninguna transferencia.';

export const RATE_LIMITS = {
  login: { points: 5, durationSec: 60 },
  orders: { points: 30, durationSec: 60 },
  kycStart: { points: 3, durationSec: 60 * 60 },
  default: { points: 60, durationSec: 60 },
} as const;
