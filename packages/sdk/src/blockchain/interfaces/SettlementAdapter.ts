import type { Address, Hex } from 'viem';

export interface MatchInput {
  buyOrderHash: Hex;
  sellOrderHash: Hex;
  buyer: Address;
  seller: Address;
  token: Address;
  qty: bigint;
  price: bigint;
}

export interface SettlementAdapter {
  executeMatch(input: MatchInput): Promise<{ txHash: Hex; blockNumber: bigint }>;
  getFee(): Promise<number>;
}
