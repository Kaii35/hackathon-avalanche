import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import type Redis from 'ioredis';
import {
  MockComplianceRegistry,
  MockIdentityRegistry,
  MockOrderbook,
  MockSecurityToken,
  MockSettlement,
  getMockChainState,
} from './blockchain/mock';
import {
  AvalancheIdentityRegistry,
  AvalancheComplianceRegistry,
  AvalancheSecurityToken,
  AvalancheSettlement,
  AvalancheOrderbook,
} from './blockchain/avalanche';
import type {
  ComplianceRegistryAdapter,
  IdentityRegistryAdapter,
  OrderbookAdapter,
  SecurityTokenAdapter,
  SettlementAdapter,
} from './blockchain/interfaces';
import { EventBus, getEventBus, setEventBus } from './events/bus';

export type ChainMode = 'mock' | 'avalanche';

export interface SdkConfig {
  rpcUrl?: string;
  identityRegistry?: Address;
  complianceRegistry?: Address;
  tokenFactory?: Address;
  settlement?: Address;
  usdc?: Address;
  mode?: ChainMode;
  redis?: Redis;
  signerPrivateKey?: Hex;
}

export class IfcMarketClient {
  public readonly publicClient: PublicClient | null;
  public readonly mode: ChainMode;
  public readonly identity: IdentityRegistryAdapter;
  public readonly compliance: ComplianceRegistryAdapter;
  public readonly token: SecurityTokenAdapter;
  public readonly settlement: SettlementAdapter;
  public readonly orderbook: OrderbookAdapter;
  public readonly events: EventBus;

  constructor(public readonly config: SdkConfig = {}) {
    this.mode = config.mode ?? 'mock';

    if (config.redis) {
      const bus = new EventBus({ redis: config.redis });
      setEventBus(bus);
    }
    this.events = getEventBus();

    if (this.mode === 'avalanche') {
      const rpcUrl =
        config.rpcUrl ??
        process.env['AVALANCHE_RPC_URL'] ??
        'https://api.avax-test.network/ext/bc/C/rpc';

      const publicClient = createPublicClient({
        chain: avalancheFuji,
        transport: http(rpcUrl),
      });
      this.publicClient = publicClient;

      // walletClient is optional — reads work without it; writes throw a clear message
      let walletClient: WalletClient | null = null;
      const signerKey =
        config.signerPrivateKey ?? (process.env['DEPLOYER_PRIVATE_KEY'] as Hex | undefined);
      if (signerKey) {
        const account = privateKeyToAccount(signerKey);
        walletClient = createWalletClient({
          account,
          chain: avalancheFuji,
          transport: http(rpcUrl),
        });
      }

      const identityRegistryAddress =
        config.identityRegistry ??
        (process.env['NEXT_PUBLIC_IDENTITY_REGISTRY'] as Address | undefined);
      const complianceRegistryAddress =
        config.complianceRegistry ??
        (process.env['NEXT_PUBLIC_COMPLIANCE_REGISTRY'] as Address | undefined);
      const tokenFactoryAddress =
        config.tokenFactory ?? (process.env['NEXT_PUBLIC_TOKEN_FACTORY'] as Address | undefined);
      const settlementAddress =
        config.settlement ?? (process.env['NEXT_PUBLIC_SETTLEMENT'] as Address | undefined);

      if (!identityRegistryAddress) {
        throw new Error(
          'Modo avalanche requiere NEXT_PUBLIC_IDENTITY_REGISTRY o config.identityRegistry',
        );
      }
      if (!complianceRegistryAddress) {
        throw new Error(
          'Modo avalanche requiere NEXT_PUBLIC_COMPLIANCE_REGISTRY o config.complianceRegistry',
        );
      }
      if (!tokenFactoryAddress) {
        throw new Error('Modo avalanche requiere NEXT_PUBLIC_TOKEN_FACTORY o config.tokenFactory');
      }
      if (!settlementAddress) {
        throw new Error('Modo avalanche requiere NEXT_PUBLIC_SETTLEMENT o config.settlement');
      }

      this.identity = new AvalancheIdentityRegistry(
        publicClient,
        walletClient,
        identityRegistryAddress,
        this.events,
      );
      this.compliance = new AvalancheComplianceRegistry(
        publicClient,
        walletClient,
        complianceRegistryAddress,
      );
      this.token = new AvalancheSecurityToken(
        publicClient,
        walletClient,
        tokenFactoryAddress,
        this.events,
      );
      this.settlement = new AvalancheSettlement(
        publicClient,
        walletClient,
        settlementAddress,
        this.events,
      );
      this.orderbook = new AvalancheOrderbook(publicClient, settlementAddress, this.events);

      return;
    }

    // ─── Mock mode ───────────────────────────────────────────────────────────
    this.publicClient = config.rpcUrl
      ? createPublicClient({ chain: avalancheFuji, transport: http(config.rpcUrl) })
      : null;

    const state = getMockChainState();
    this.identity = new MockIdentityRegistry(state, this.events);
    this.compliance = new MockComplianceRegistry(state);
    this.token = new MockSecurityToken(state, this.events);
    this.settlement = new MockSettlement(state, this.events);
    this.orderbook = new MockOrderbook(state, this.events);
  }
}
