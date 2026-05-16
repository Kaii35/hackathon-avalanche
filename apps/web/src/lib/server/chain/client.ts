import { IfcMarketClient } from '@hack/sdk';
import type { Address, Hex } from 'viem';
import { redis } from '../redis';

const globalForChain = globalThis as unknown as { chainClient?: IfcMarketClient };

function createClient(): IfcMarketClient {
  const mode = (process.env.CHAIN_MODE ?? 'mock') as 'mock' | 'avalanche';
  return new IfcMarketClient({
    mode,
    redis,
    rpcUrl: process.env.AVALANCHE_RPC_URL,
    identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as Address | undefined,
    complianceRegistry: process.env.NEXT_PUBLIC_COMPLIANCE_REGISTRY as Address | undefined,
    tokenFactory: process.env.NEXT_PUBLIC_TOKEN_FACTORY as Address | undefined,
    settlement: process.env.NEXT_PUBLIC_SETTLEMENT as Address | undefined,
    usdc: process.env.NEXT_PUBLIC_USDC as Address | undefined,
    signerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined,
  });
}

export const chainClient: IfcMarketClient = globalForChain.chainClient ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForChain.chainClient = chainClient;
}
