import type { Address, Hex } from 'viem';

export interface IdentityRecord {
  wallet: Address;
  jurisdiction: number;
  accredited: boolean;
  claimHash: Hex;
  verifiedAt: number;
  frozen: boolean;
}

export interface IdentityRegistryAdapter {
  registerIdentity(input: {
    wallet: Address;
    jurisdiction: number;
    accredited: boolean;
    claimHash: Hex;
  }): Promise<{ txHash: Hex }>;

  removeIdentity(wallet: Address): Promise<{ txHash: Hex }>;

  isVerified(wallet: Address): Promise<boolean>;

  getIdentity(wallet: Address): Promise<IdentityRecord | null>;
}
