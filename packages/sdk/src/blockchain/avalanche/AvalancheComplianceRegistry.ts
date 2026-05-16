import type { PublicClient, WalletClient, Address } from 'viem';
import type {
  ComplianceCheckResult,
  ComplianceRegistryAdapter,
} from '../interfaces/ComplianceRegistryAdapter';
import { COMPLIANCE_MANAGER_ABI, SECURITY_TOKEN_ABI } from './abi';
import { requireWallet } from './helpers';

export class AvalancheComplianceRegistry implements ComplianceRegistryAdapter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly complianceManagerAddress: Address,
  ) {}

  /**
   * Checks whether a transfer is allowed by simulating SecurityToken.transferFrom.
   *
   * We simulate the token leg rather than calling ComplianceManager.canTransfer
   * directly because ComplianceManager uses msg.sender (the calling token's
   * address) to scope per-token module checks — calling it externally would
   * bypass those module checks since msg.sender would be an EOA.
   */
  async canTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<ComplianceCheckResult> {
    try {
      await this.publicClient.simulateContract({
        address: input.token,
        abi: SECURITY_TOKEN_ABI,
        functionName: 'transferFrom',
        args: [input.from, input.to, input.amount],
        account: input.from,
      });
      return { allowed: true, reasons: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Extract a concise reason from viem's contract error formatting
      const reason = extractRevertReason(msg);
      return { allowed: false, reasons: [reason] };
    }
  }

  async addModule(token: Address, module: string): Promise<void> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const moduleAddress = module as Address;
    const hash = await wc.writeContract({
      address: this.complianceManagerAddress,
      abi: COMPLIANCE_MANAGER_ABI,
      functionName: 'bindModule',
      args: [token, moduleAddress],
      account,
      chain: wc.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  async removeModule(token: Address, module: string): Promise<void> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const moduleAddress = module as Address;
    const hash = await wc.writeContract({
      address: this.complianceManagerAddress,
      abi: COMPLIANCE_MANAGER_ABI,
      functionName: 'unbindModule',
      args: [token, moduleAddress],
      account,
      chain: wc.chain,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
}

function extractRevertReason(msg: string): string {
  // viem surfaces custom error names in the message
  const match =
    msg.match(/reverted with the following reason:\s*(.+)/i) ??
    msg.match(/error:\s*(.+)/i) ??
    msg.match(/(ComplianceCheckFailed|WalletFrozen|Paused)\(.*?\)/);
  if (match?.[1]) return match[1].trim();
  if (msg.includes('ComplianceCheckFailed'))
    return 'Compliance check falló (KYC o módulo rechazó la transferencia)';
  if (msg.includes('WalletFrozen')) return 'Wallet congelada';
  if (msg.includes('Paused')) return 'Token pausado';
  return msg.slice(0, 200);
}
