import type { Address, Hex } from 'viem';
import type { OnChainOrder, OrderbookAdapter } from '../interfaces/OrderbookAdapter';
import { getEventBus, type EventBus } from '../../events/bus';
import { MockChainState, getMockChainState } from './state';

export class MockOrderbook implements OrderbookAdapter {
  constructor(
    private readonly state: MockChainState = getMockChainState(),
    private readonly bus: EventBus = getEventBus(),
  ) {}

  async postOrder(input: {
    orderHash: Hex;
    maker: Address;
    token: Address;
    side: 0 | 1;
    qty: bigint;
    price: bigint;
    expiresAt: number;
  }): Promise<{ txHash: Hex }> {
    const onChain: OnChainOrder = {
      orderHash: input.orderHash,
      maker: input.maker.toLowerCase() as Address,
      token: input.token.toLowerCase() as Address,
      side: input.side,
      qty: input.qty,
      price: input.price,
      expiresAt: input.expiresAt,
      cancelled: false,
    };
    this.state.orders.set(input.orderHash, onChain);
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'OrderPosted',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      orderHash: input.orderHash,
      maker: onChain.maker,
      token: onChain.token,
      side: input.side,
      qty: input.qty.toString(),
      price: input.price.toString(),
      expiresAt: input.expiresAt,
    });
    return { txHash };
  }

  async cancelOrder(input: { orderHash: Hex; maker: Address }): Promise<{ txHash: Hex }> {
    const order = this.state.orders.get(input.orderHash);
    if (order) order.cancelled = true;
    const txHash = this.state.txHash();
    const blockNumber = this.state.nextBlock();
    await this.bus.emit({
      id: this.state.eventId(),
      type: 'OrderCancelled',
      txHash,
      blockNumber,
      timestamp: Date.now(),
      orderHash: input.orderHash,
      maker: input.maker.toLowerCase() as Address,
    });
    return { txHash };
  }

  async getOrder(orderHash: Hex): Promise<OnChainOrder | null> {
    return this.state.orders.get(orderHash) ?? null;
  }
}
