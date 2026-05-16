import type { PublicClient, WalletClient, Address, Hex } from 'viem';
import type {
  IdentityRecord,
  IdentityRegistryAdapter,
} from '../interfaces/IdentityRegistryAdapter';
import type { EventBus } from '../../events/bus';
import { IDENTITY_REGISTRY_ABI } from './abi';
import { requireWallet } from './helpers';

export class AvalancheIdentityRegistry implements IdentityRegistryAdapter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly registryAddress: Address,
    private readonly bus: EventBus,
  ) {}

  async isVerified(wallet: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'isVerified',
      args: [wallet],
    });
  }

  /**
   * Registers (verifies) a wallet on-chain via verifyAddress(address).
   *
   * Note: the on-chain IdentityRegistry only stores a boolean verified flag —
   * jurisdiction, accredited, and claimHash are NOT persisted on-chain in this
   * contract version. Those fields are off-chain metadata in Postgres.
   * They are accepted here to satisfy the interface but ignored in the tx.
   */
  async registerIdentity(input: {
    wallet: Address;
    jurisdiction: number;
    accredited: boolean;
    claimHash: Hex;
  }): Promise<{ txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const hash = await wc.writeContract({
      address: this.registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'verifyAddress',
      args: [input.wallet],
      account,
      chain: wc.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'IdentityRegistered',
      txHash: hash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      wallet: input.wallet,
      jurisdiction: input.jurisdiction,
      accredited: input.accredited,
      claimHash: input.claimHash,
    });

    return { txHash: hash };
  }

  async removeIdentity(wallet: Address): Promise<{ txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const hash = await wc.writeContract({
      address: this.registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'revokeAddress',
      args: [wallet],
      account,
      chain: wc.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'IdentityRemoved',
      txHash: hash,
      blockNumber: 0n, // blockNumber comes from receipt but IdentityRemovedEvent doesn't need it for consumers
      timestamp: Date.now(),
      wallet,
    });

    return { txHash: hash };
  }

  /**
   * Returns identity data for a wallet. Because the on-chain contract only
   * stores a boolean, the extra fields (jurisdiction, accredited, claimHash,
   * verifiedAt, frozen) are returned as zero-value placeholders. The source
   * of truth for those fields is the Postgres `users` / `kyc_sessions` tables.
   */
  async getIdentity(wallet: Address): Promise<IdentityRecord | null> {
    const verified = await this.isVerified(wallet);
    if (!verified) return null;
    return {
      wallet,
      jurisdiction: 0, // placeholder — not stored on-chain
      accredited: false, // placeholder — not stored on-chain
      claimHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      verifiedAt: 0, // placeholder — not stored on-chain
      frozen: false, // freeze state lives per-token in SecurityToken, not here
    };
  }
}
