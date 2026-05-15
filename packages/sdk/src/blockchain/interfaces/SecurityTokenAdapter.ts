import type { Address, Hex } from 'viem';

export interface DeployTokenInput {
  offeringId: string;
  name: string;
  symbol: string;
  initialHolder: Address;
  initialSupply: bigint;
  lockupUntil: number;
  maxHolders: number;
  allowedJurisdictions: number[];
}

export interface SecurityTokenAdapter {
  deploy(input: DeployTokenInput): Promise<{ tokenAddress: Address; txHash: Hex }>;

  mint(token: Address, to: Address, amount: bigint): Promise<{ txHash: Hex }>;

  balanceOf(token: Address, holder: Address): Promise<bigint>;

  transfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<{ txHash: Hex }>;

  freeze(wallet: Address, reason: string): Promise<{ txHash: Hex }>;

  unfreeze(wallet: Address): Promise<{ txHash: Hex }>;

  forcedTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
    reason: string;
  }): Promise<{ txHash: Hex }>;

  pause(token: Address): Promise<{ txHash: Hex }>;
}
