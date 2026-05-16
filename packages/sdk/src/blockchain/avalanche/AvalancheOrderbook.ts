import type { PublicClient, Address, Hex } from 'viem';
import type { OnChainOrder, OrderbookAdapter } from '../interfaces/OrderbookAdapter';
import type { EventBus } from '../../events/bus';
import { SETTLEMENT_ABI } from './abi';

const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hex;

export class AvalancheOrderbook implements OrderbookAdapter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly settlementAddress: Address,
    private readonly bus: EventBus,
  ) {}

  /**
   * No-op: orders live off-chain (Postgres + Redis orderbook cache).
   * On-chain, only the filled[] counter in Settlement records execution state
   * — orders themselves are never posted to a contract in this architecture.
   *
   * We still emit an OrderPosted event to the local bus so any in-process
   * listeners (e.g. the mock-compatible indexer) remain consistent.
   */
  async postOrder(input: {
    orderHash: Hex;
    maker: Address;
    token: Address;
    side: 0 | 1;
    qty: bigint;
    price: bigint;
    expiresAt: number;
  }): Promise<{ txHash: Hex }> {
    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'OrderPosted',
      txHash: ZERO_HASH,
      blockNumber: 0n,
      timestamp: Date.now(),
      orderHash: input.orderHash,
      maker: input.maker,
      token: input.token,
      side: input.side,
      qty: input.qty.toString(),
      price: input.price.toString(),
      expiresAt: input.expiresAt,
    });

    // Return a synthetic zero hash — no on-chain tx is produced
    return { txHash: ZERO_HASH };
  }

  /**
   * No-op: server-side on-chain cancellation is not possible.
   *
   * Settlement.cancelOrder() requires the full Order tuple signed by the
   * maker and must be called by the maker's wallet — the server cannot
   * initiate this without the holder's private key. Off-chain cancellation
   * (updating the DB status) is handled by orderRepo.cancelByMaker.
   */
  async cancelOrder(input: { orderHash: Hex; maker: Address }): Promise<{ txHash: Hex }> {
    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'OrderCancelled',
      txHash: ZERO_HASH,
      blockNumber: 0n,
      timestamp: Date.now(),
      orderHash: input.orderHash,
      maker: input.maker,
    });

    return { txHash: ZERO_HASH };
  }

  /**
   * Checks on-chain filled and cancelled state for an order hash.
   *
   * Note: order details (qty, price, maker, etc.) are NOT stored on-chain —
   * they live in Postgres. This method only surfaces execution state.
   * Returns null if the order has no on-chain state (filled == 0 && !cancelled).
   */
  async getOrder(orderHash: Hex): Promise<OnChainOrder | null> {
    const [filledQty, isCancelled] = await Promise.all([
      this.publicClient.readContract({
        address: this.settlementAddress,
        abi: SETTLEMENT_ABI,
        functionName: 'filled',
        args: [orderHash],
      }),
      this.publicClient.readContract({
        address: this.settlementAddress,
        abi: SETTLEMENT_ABI,
        functionName: 'cancelled',
        args: [orderHash],
      }),
    ]);

    if (filledQty === 0n && !isCancelled) {
      // No on-chain state — order details live off-chain in Postgres
      return null;
    }

    // Return a partial record; the fields not stored on-chain are zeroed
    return {
      orderHash,
      maker: '0x0000000000000000000000000000000000000000' as Address, // not on-chain
      token: '0x0000000000000000000000000000000000000000' as Address, // not on-chain
      side: 0, // not on-chain
      qty: filledQty, // this is the filled amount, not the original qty
      price: 0n, // not on-chain
      expiresAt: 0, // not on-chain
      cancelled: isCancelled,
    };
  }
}
