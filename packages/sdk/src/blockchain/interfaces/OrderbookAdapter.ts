import type { Address, Hex } from 'viem';

export interface OnChainOrder {
  orderHash: Hex;
  maker: Address;
  token: Address;
  side: 0 | 1;
  qty: bigint;
  price: bigint;
  expiresAt: number;
  cancelled: boolean;
}

export interface OrderbookAdapter {
  postOrder(input: {
    orderHash: Hex;
    maker: Address;
    token: Address;
    side: 0 | 1;
    qty: bigint;
    price: bigint;
    expiresAt: number;
  }): Promise<{ txHash: Hex }>;

  cancelOrder(input: { orderHash: Hex; maker: Address }): Promise<{ txHash: Hex }>;

  getOrder(orderHash: Hex): Promise<OnChainOrder | null>;
}
