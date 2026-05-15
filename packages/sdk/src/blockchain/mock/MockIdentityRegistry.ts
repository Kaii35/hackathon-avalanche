import type { Address, Hex } from 'viem';
import type {
  IdentityRecord,
  IdentityRegistryAdapter,
} from '../interfaces/IdentityRegistryAdapter';
import { getEventBus, type EventBus } from '../../events/bus';
import { MockChainState, getMockChainState } from './state';

export class MockIdentityRegistry implements IdentityRegistryAdapter {
  constructor(
    private readonly state: MockChainState = getMockChainState(),
    private readonly bus: EventBus = getEventBus(),
  ) {}

  async registerIdentity(input: {
    wallet: Address;
    jurisdiction: number;
    accredited: boolean;
    claimHash: Hex;
  }): Promise<{ txHash: Hex }> {
    const wallet = input.wallet.toLowerCase() as Address;
    const record: IdentityRecord = {
      wallet,
      jurisdiction: input.jurisdiction,
      accredited: input.accredited,
      claimHash: input.claimHash,
      verifiedAt: Math.floor(Date.now() / 1000),
      frozen: false,
    };
    this.state.identities.set(wallet, record);
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'IdentityRegistered',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      wallet,
      jurisdiction: input.jurisdiction,
      accredited: input.accredited,
      claimHash: input.claimHash,
    });
    return { txHash };
  }

  async removeIdentity(wallet: Address): Promise<{ txHash: Hex }> {
    const w = wallet.toLowerCase() as Address;
    this.state.identities.delete(w);
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'IdentityRemoved',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      wallet: w,
    });
    return { txHash };
  }

  async isVerified(wallet: Address): Promise<boolean> {
    return this.state.identities.has(wallet.toLowerCase() as Address);
  }

  async getIdentity(wallet: Address): Promise<IdentityRecord | null> {
    return this.state.identities.get(wallet.toLowerCase() as Address) ?? null;
  }
}
