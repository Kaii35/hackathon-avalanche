import type { Address } from 'viem';

export interface ComplianceCheckResult {
  allowed: boolean;
  reasons: string[];
}

export interface ComplianceRegistryAdapter {
  canTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<ComplianceCheckResult>;

  addModule(token: Address, module: string): Promise<void>;

  removeModule(token: Address, module: string): Promise<void>;
}
