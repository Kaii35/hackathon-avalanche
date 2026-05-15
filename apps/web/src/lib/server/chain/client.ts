import { IfcMarketClient } from '@hack/sdk';
import { redis } from '../redis';

const globalForChain = globalThis as unknown as { chainClient?: IfcMarketClient };

function createClient(): IfcMarketClient {
  const mode = (process.env.CHAIN_MODE ?? 'mock') as 'mock' | 'avalanche';
  return new IfcMarketClient({ mode, redis });
}

export const chainClient: IfcMarketClient = globalForChain.chainClient ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForChain.chainClient = chainClient;
}
