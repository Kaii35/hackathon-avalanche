import type { Address } from 'viem';

export const ORDER_TYPE = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'qty', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
  ],
} as const;

export interface OrderPayload {
  maker: Address;
  token: Address;
  side: 0 | 1; // 0 = buy, 1 = sell
  qty: bigint;
  price: bigint;
  expiresAt: bigint;
  salt: bigint;
}

export function getDomain(chainId: number, verifyingContract: Address) {
  return {
    name: 'IfcMarket',
    version: '1',
    chainId,
    verifyingContract,
  } as const;
}
