import { createPublicClient, http, type Address, type PublicClient } from 'viem';
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
      throw new Error(
        'IfcMarketClient: modo avalanche no implementado en este pase. Usa mode "mock".',
      );
    }

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
