import type { Address, Hex } from 'viem';
import type { SettlementOrder } from '../../eip712';

export interface MatchInput {
  // Legacy fields used by MockSettlement and for audit/log purposes
  buyOrderHash: Hex;
  sellOrderHash: Hex;
  buyer: Address;
  seller: Address;
  token: Address;
  qty: bigint;
  price: bigint;

  // Required by AvalancheSettlement.executeMatch — the full Order tuples and
  // EIP-712 signatures from each maker.
  buyOrder?: SettlementOrder;
  buySignature?: Hex;
  sellOrder?: SettlementOrder;
  sellSignature?: Hex;
}

export interface SettlementAdapter {
  executeMatch(input: MatchInput): Promise<{ txHash: Hex; blockNumber: bigint }>;
  getFee(): Promise<number>;
}

export type { SettlementOrder };
