import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { avalancheFuji } from 'viem/chains';

export interface SdkConfig {
  rpcUrl: string;
  identityRegistry: Address;
  complianceRegistry: Address;
  tokenFactory: Address;
  settlement: Address;
  usdc: Address;
}

export class IfcMarketClient {
  public readonly publicClient: PublicClient;
  constructor(public readonly config: SdkConfig) {
    this.publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(config.rpcUrl),
    });
  }

  // TODO: read methods (offerings, balances, orderbook)
  // TODO: write methods (registerIdentity, deployToken, executeMatch)
}
