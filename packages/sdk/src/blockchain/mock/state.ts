import type { Address, Hex } from 'viem';
import type { IdentityRecord } from '../interfaces/IdentityRegistryAdapter';
import type { OnChainOrder } from '../interfaces/OrderbookAdapter';

// Browser-and-Node compatible random bytes via the Web Crypto API.
// Avoids `node:crypto` so this module can be imported safely from client
// bundles (e.g. orderbook.ts in the web app). Web Crypto is available in
// all modern browsers and Node ≥19.
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let out = '';
  for (const b of buf) out += b.toString(16).padStart(2, '0');
  return out;
}

export interface TokenState {
  address: Address;
  offeringId: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  lockupUntil: number;
  maxHolders: number;
  allowedJurisdictions: number[];
  paused: boolean;
  balances: Map<Address, bigint>;
}

export class MockChainState {
  blockNumber = 1n;
  readonly identities = new Map<Address, IdentityRecord>();
  readonly tokens = new Map<Address, TokenState>();
  readonly orders = new Map<Hex, OnChainOrder>();
  readonly modulesByToken = new Map<Address, Set<string>>();

  nextBlock(): bigint {
    this.blockNumber += 1n;
    return this.blockNumber;
  }

  txHash(): Hex {
    return ('0x' + randomHex(32)) as Hex;
  }

  tokenAddress(): Address {
    return ('0x' + randomHex(20)).toLowerCase() as Address;
  }

  eventId(): string {
    return randomHex(16);
  }
}

let singleton: MockChainState | undefined;

export function getMockChainState(): MockChainState {
  if (!singleton) {
    singleton = new MockChainState();
  }
  return singleton;
}

export function resetMockChainState(): void {
  singleton = new MockChainState();
}
