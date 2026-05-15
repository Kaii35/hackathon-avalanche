export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';

export interface Order {
  id: string;
  orderHash: `0x${string}`;
  maker: `0x${string}`;
  token: `0x${string}`;
  side: OrderSide;
  qty: string; // decimal string
  price: string; // total price in stablecoin units
  signature: `0x${string}`;
  expiresAt: number;
  createdAt: number;
  status: OrderStatus;
}

export interface Trade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  qty: string;
  price: string;
  txHash: `0x${string}`;
  settledAt: number;
}
