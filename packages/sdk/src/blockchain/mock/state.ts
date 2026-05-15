import { randomBytes } from 'node:crypto';
import type { Address, Hex } from 'viem';
import type { IdentityRecord } from '../interfaces/IdentityRegistryAdapter';
import type { OnChainOrder } from '../interfaces/OrderbookAdapter';

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
    return ('0x' + randomBytes(32).toString('hex')) as Hex;
  }

  tokenAddress(): Address {
    return ('0x' + randomBytes(20).toString('hex')).toLowerCase() as Address;
  }

  eventId(): string {
    return randomBytes(16).toString('hex');
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
