import type { Hex } from 'viem';
import type { MatchInput, SettlementAdapter } from '../interfaces/SettlementAdapter';
import { getEventBus, type EventBus } from '../../events/bus';
import { MockChainState, getMockChainState } from './state';
import { MockSecurityToken } from './MockSecurityToken';
import { MockComplianceRegistry } from './MockComplianceRegistry';

const FEE_BPS = 50;

export class MockSettlement implements SettlementAdapter {
  constructor(
    private readonly state: MockChainState = getMockChainState(),
    private readonly bus: EventBus = getEventBus(),
    private readonly token: MockSecurityToken = new MockSecurityToken(state, bus),
    private readonly compliance: MockComplianceRegistry = new MockComplianceRegistry(state),
  ) {}

  async executeMatch(input: MatchInput): Promise<{ txHash: Hex; blockNumber: bigint }> {
    const check = await this.compliance.canTransfer({
      token: input.token,
      from: input.seller,
      to: input.buyer,
      amount: input.qty,
    });
    if (!check.allowed) {
      throw new Error(`compliance rejected: ${check.reasons.join(', ')}`);
    }

    await this.token.transfer({
      token: input.token,
      from: input.seller,
      to: input.buyer,
      amount: input.qty,
    });

    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    const ts = Date.now();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'TradeExecuted',
      txHash,
      blockNumber,
      timestamp: ts,
      buyOrderHash: input.buyOrderHash,
      sellOrderHash: input.sellOrderHash,
      token: input.token,
      buyer: input.buyer,
      seller: input.seller,
      qty: input.qty.toString(),
      price: input.price.toString(),
      feeBps: FEE_BPS,
    });
    return { txHash, blockNumber };
  }

  async getFee(): Promise<number> {
    return FEE_BPS;
  }
}
