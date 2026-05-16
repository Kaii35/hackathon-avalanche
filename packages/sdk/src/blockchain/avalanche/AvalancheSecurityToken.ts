import {
  keccak256,
  toBytes,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
} from 'viem';
import type { DeployTokenInput, SecurityTokenAdapter } from '../interfaces/SecurityTokenAdapter';
import type { EventBus } from '../../events/bus';
import { TOKEN_FACTORY_ABI, SECURITY_TOKEN_ABI } from './abi';
import { requireWallet } from './helpers';

export class AvalancheSecurityToken implements SecurityTokenAdapter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly tokenFactoryAddress: Address,
    private readonly bus: EventBus,
  ) {}

  /**
   * Deploys a new SecurityToken via TokenFactory.deployOffering.
   *
   * Note: lockupUntil, maxHolders, and allowedJurisdictions are NOT applied
   * during deployment — those require binding HoldingPeriodModule, MaxHoldersModule,
   * and JurisdictionModule to the ComplianceManager after deployment, which is
   * out-of-scope for this MVP. Documented as tech debt.
   */
  async deploy(input: DeployTokenInput): Promise<{ tokenAddress: Address; txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    // offeringId must be bytes32 — keccak256 of the UUID string
    const offeringIdBytes32 = keccak256(toBytes(input.offeringId)) as Hex;

    // issuerAdmin and complianceAgent are the server signer for the MVP
    const signerAddress = account.address;

    const hash = await wc.writeContract({
      address: this.tokenFactoryAddress,
      abi: TOKEN_FACTORY_ABI,
      functionName: 'deployOffering',
      args: [
        offeringIdBytes32,
        input.name,
        input.symbol,
        signerAddress, // issuerAdmin
        signerAddress, // complianceAgent
        input.initialSupply,
        input.initialHolder,
      ],
      account,
      chain: wc.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse OfferingDeployed event to extract the token address
    let tokenAddress: Address | undefined;
    for (const log of receipt.logs) {
      try {
        // OfferingDeployed: topic[0] = keccak256("OfferingDeployed(bytes32,address,address,...)")
        // The token address is the second indexed topic (topic[2])
        if (
          log.topics.length >= 3 &&
          log.address.toLowerCase() === this.tokenFactoryAddress.toLowerCase()
        ) {
          // topic[2] is the `token` indexed parameter (address padded to 32 bytes)
          const tokenTopic = log.topics[2];
          if (tokenTopic) {
            tokenAddress = ('0x' + tokenTopic.slice(26)) as Address;
          }
        }
      } catch {
        // continue scanning logs
      }
    }

    if (!tokenAddress) {
      throw new Error('No se pudo extraer la dirección del token del evento OfferingDeployed');
    }

    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'TokenDeployed',
      txHash: hash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      offeringId: input.offeringId,
      tokenAddress,
      initialSupply: input.initialSupply.toString(),
    });

    return { tokenAddress, txHash: hash };
  }

  async mint(token: Address, to: Address, amount: bigint): Promise<{ txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const hash = await wc.writeContract({
      address: token,
      abi: SECURITY_TOKEN_ABI,
      functionName: 'mint',
      args: [to, amount],
      account,
      chain: wc.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  }

  async balanceOf(token: Address, holder: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: token,
      abi: SECURITY_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [holder],
    });
  }

  /**
   * Not supported server-side: transfer requires the holder's private key.
   * Use forcedTransfer for recovery flows, or route through the matching
   * engine (approve + Settlement.executeMatch) for secondary market transfers.
   */
  async transfer(_input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
  }): Promise<{ txHash: Hex }> {
    throw new Error(
      'transfer no está disponible desde el servidor. ' +
        'Usa forcedTransfer para recuperación, o el matching engine para el mercado secundario.',
    );
  }

  /**
   * freeze/unfreeze are per-token operations in SecurityToken, but the
   * SecurityTokenAdapter interface does not include the token address.
   * This is a known API design mismatch — documented as tech debt.
   *
   * Tech debt: freeze/unfreeze sin parámetro token — la interfaz del mock
   * no soporta modo avalanche. Requiere refactorizar SecurityTokenAdapter
   * para incluir `token` en freeze/unfreeze, o exponer una variante nueva.
   */
  async freeze(_wallet: Address, _reason: string): Promise<{ txHash: Hex }> {
    throw new Error(
      'freeze/unfreeze requiere especificar token; API legacy del mock no soportada en modo avalanche. ' +
        'Usa el endpoint /api/admin/freeze que incluye el token address.',
    );
  }

  async unfreeze(_wallet: Address): Promise<{ txHash: Hex }> {
    throw new Error(
      'freeze/unfreeze requiere especificar token; API legacy del mock no soportada en modo avalanche. ' +
        'Usa el endpoint /api/admin/freeze que incluye el token address.',
    );
  }

  async forcedTransfer(input: {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
    reason: string;
  }): Promise<{ txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    // reason is stored in audit_log on the backend — it does not go on-chain
    const hash = await wc.writeContract({
      address: input.token,
      abi: SECURITY_TOKEN_ABI,
      functionName: 'forcedTransfer',
      args: [input.from, input.to, input.amount],
      account,
      chain: wc.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'ForcedTransfer',
      txHash: hash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      token: input.token,
      from: input.from,
      to: input.to,
      value: input.amount.toString(),
      reason: input.reason,
    });

    return { txHash: hash };
  }

  async pause(token: Address): Promise<{ txHash: Hex }> {
    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    const hash = await wc.writeContract({
      address: token,
      abi: SECURITY_TOKEN_ABI,
      functionName: 'pause',
      args: [],
      account,
      chain: wc.chain,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  }
}
