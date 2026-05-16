import type { PublicClient, WalletClient, Address, Hex } from 'viem';
import type { MatchInput, SettlementAdapter } from '../interfaces/SettlementAdapter';
import type { EventBus } from '../../events/bus';
import { SETTLEMENT_ABI } from './abi';
import { requireWallet } from './helpers';

/**
 * Unit conventions — this adapter is a pure pass-through.
 *
 * Callers MUST pass qty and price already in on-chain base units:
 *   qty   — token base units (18 decimals), e.g. parseUnits("10", 18)
 *   price — USDC base units (6 decimals),   e.g. parseUnits("5.50", 6)
 *
 * Scaling is performed once, at the boundary, by:
 *   - order.service.ts  (verify-time, on order POST)
 *   - matching.service.ts (settle-time, when building SettlementOrder tuples)
 *
 * Both use viem's parseUnits as the single canonical scaling function.
 * This adapter does NOT multiply or shift any value — what it receives is
 * what goes directly into writeContract.
 */

export class AvalancheSettlement implements SettlementAdapter {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | null,
    private readonly settlementAddress: Address,
    private readonly bus: EventBus,
  ) {}

  async executeMatch(input: MatchInput): Promise<{ txHash: Hex; blockNumber: bigint }> {
    const { buyOrder, buySignature, sellOrder, sellSignature } = input;

    if (!buyOrder || !buySignature || !sellOrder || !sellSignature) {
      throw new Error(
        'executeMatch en modo avalanche requiere buyOrder, buySignature, sellOrder, sellSignature. ' +
          'Verifica que el matching service construya las Order tuples completas antes de llamar.',
      );
    }

    const wc = requireWallet(this.walletClient);
    const account = wc.account;
    if (!account) throw new Error('No hay cuenta disponible en el walletClient');

    // Pass-through: input values are already in base units (see JSDoc above).
    const fillQty = input.qty;

    const buyTuple = {
      maker: buyOrder.maker,
      token: buyOrder.token,
      paymentToken: buyOrder.paymentToken,
      side: buyOrder.side as number,
      qty: buyOrder.qty,
      price: buyOrder.price,
      expiresAt: buyOrder.expiresAt,
      salt: buyOrder.salt,
    };

    const sellTuple = {
      maker: sellOrder.maker,
      token: sellOrder.token,
      paymentToken: sellOrder.paymentToken,
      side: sellOrder.side as number,
      qty: sellOrder.qty,
      price: sellOrder.price,
      expiresAt: sellOrder.expiresAt,
      salt: sellOrder.salt,
    };

    const hash = await wc.writeContract({
      address: this.settlementAddress,
      abi: SETTLEMENT_ABI,
      functionName: 'executeMatch',
      args: [buyTuple, buySignature, sellTuple, sellSignature, fillQty],
      account,
      chain: wc.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Emit TradeExecuted event to the internal event bus so the indexer
    // and any in-process listeners can react
    await this.bus.emit({
      id: crypto.randomUUID(),
      type: 'TradeExecuted',
      txHash: hash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      buyOrderHash: input.buyOrderHash,
      sellOrderHash: input.sellOrderHash,
      token: input.token,
      buyer: input.buyer,
      seller: input.seller,
      qty: input.qty.toString(),
      price: input.price.toString(),
      feeBps: 0, // actual fee comes from the on-chain event; 0 here is a placeholder
    });

    return { txHash: hash, blockNumber: receipt.blockNumber };
  }

  async getFee(): Promise<number> {
    const feeBps = await this.publicClient.readContract({
      address: this.settlementAddress,
      abi: SETTLEMENT_ABI,
      functionName: 'feeBps',
    });
    return Number(feeBps);
  }
}
