import { keccak256, encodeAbiParameters, parseUnits, type Address } from 'viem';
import { verifyTypedData } from 'viem';
import { ORDER_TYPE, getDomain, type OrderPayload } from '@hack/sdk';
import { Prisma, prisma } from '@hack/database';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type CreateOrderDto,
  type OrderResponseDto,
  type OrderbookResponseDto,
  type BookLevelDto,
} from '@hack/shared';
import { orderRepo } from '../repositories/order.repo';
import { tradeRepo } from '../repositories/trade.repo';
import { offeringRepo } from '../repositories/offering.repo';
import { chainClient } from '../chain/client';
import { redis } from '../redis';

const ORDERBOOK_CACHE_TTL = 5;

function bookCacheKey(offeringId: string): string {
  return `book:${offeringId}`;
}

/**
 * Computes a deterministic order hash matching the on-chain ORDER_TYPEHASH.
 * Includes all 8 fields: maker, token, paymentToken, side, qty, price, expiresAt, salt.
 */
function computeOrderHash(
  payload: OrderPayload,
  verifyingContract: Address,
  chainId: number,
): `0x${string}` {
  const types = ORDER_TYPE.Order;
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint8' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [
        types.map((t) => `${t.name}:${t.type}`).join('|'),
        BigInt(chainId),
        verifyingContract,
        payload.maker,
        payload.token,
        payload.paymentToken,
        payload.side,
        payload.qty,
        payload.price,
        payload.expiresAt,
        payload.salt,
      ],
    ),
  );
}

function toResponse(o: {
  id: string;
  orderHash: string;
  offeringId: string;
  makerWallet: string;
  side: 'buy' | 'sell';
  qty: Prisma.Decimal;
  price: Prisma.Decimal;
  filledQty: Prisma.Decimal;
  status: 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}): OrderResponseDto {
  return {
    id: o.id,
    orderHash: o.orderHash as `0x${string}`,
    offeringId: o.offeringId,
    maker: o.makerWallet as `0x${string}`,
    side: o.side,
    qty: o.qty.toString(),
    price: o.price.toString(),
    filledQty: o.filledQty.toString(),
    status: o.status,
    expiresAt: o.expiresAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
  };
}

export const orderService = {
  async create(actorUserId: string, dto: CreateOrderDto): Promise<OrderResponseDto> {
    const offering = await offeringRepo.findById(dto.offeringId);
    if (!offering) throw new NotFoundError('Oferta');
    if (!offering.tokenAddress) throw new ConflictError('La oferta no tiene token desplegado');

    // Case-insensitive match — Zod ya lowercase'a dto.maker pero el address
    // en DB puede estar en EIP-55 según cómo se haya linkeado (script, SIWE,
    // seed). Comparamos sin caso para no exigir convención de storage.
    const ownsWallet = await prisma.wallet.findFirst({
      where: {
        userId: actorUserId,
        address: { equals: dto.maker, mode: 'insensitive' },
      },
    });
    if (!ownsWallet) throw new ForbiddenError('La wallet no pertenece al usuario autenticado');

    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt.getTime() <= Date.now()) throw new ConflictError('La orden ya expiró');

    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);
    const verifyingContract = (process.env.NEXT_PUBLIC_SETTLEMENT ??
      '0x0000000000000000000000000000000000000001') as Address;
    const paymentToken = (process.env.NEXT_PUBLIC_USDC ??
      '0x0000000000000000000000000000000000000002') as Address;

    // Canonical scaling: parseUnits is the single source of truth.
    // Frontend signs with these same values; backend re-derives to verify.
    const TOKEN_DECIMALS = 18;
    const USDC_DECIMALS = 6;
    const qtyBaseUnits = parseUnits(dto.qty, TOKEN_DECIMALS);
    const priceBaseUnits = parseUnits(dto.price, USDC_DECIMALS);

    const payload: OrderPayload = {
      maker: dto.maker,
      token: offering.tokenAddress as Address,
      paymentToken,
      side: dto.side === 'buy' ? 0 : 1,
      qty: qtyBaseUnits, // base units — matches what the wallet signed
      price: priceBaseUnits, // base units — matches what the wallet signed
      expiresAt: BigInt(Math.floor(expiresAt.getTime() / 1000)),
      salt: BigInt(dto.salt),
    };

    const valid = await verifyTypedData({
      address: dto.maker,
      domain: getDomain(chainId, verifyingContract),
      types: ORDER_TYPE,
      primaryType: 'Order',
      message: payload,
      signature: dto.signature as `0x${string}`,
    });
    if (!valid) throw new ConflictError('Firma EIP-712 inválida');

    const orderHash = computeOrderHash(payload, verifyingContract, chainId);

    const created = await orderRepo.create({
      orderHash,
      makerWallet: dto.maker,
      offering: { connect: { id: dto.offeringId } },
      side: dto.side,
      qty: new Prisma.Decimal(dto.qty),
      price: new Prisma.Decimal(dto.price),
      signature: dto.signature,
      expiresAt,
      salt: dto.salt,
    });

    await chainClient.orderbook.postOrder({
      orderHash,
      maker: dto.maker,
      token: offering.tokenAddress as Address,
      side: payload.side,
      qty: payload.qty,
      price: payload.price,
      expiresAt: Number(payload.expiresAt),
    });

    await redis.del(bookCacheKey(dto.offeringId));
    return toResponse(created);
  },

  async cancel(actorUserId: string, orderId: string): Promise<{ cancelled: boolean }> {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new NotFoundError('Orden');
    // Case-insensitive match (mismo motivo que en create).
    const ownsWallet = await prisma.wallet.findFirst({
      where: {
        userId: actorUserId,
        address: { equals: order.makerWallet, mode: 'insensitive' },
      },
    });
    if (!ownsWallet) throw new ForbiddenError('No puedes cancelar órdenes de otra wallet');

    const result = await orderRepo.cancelByMaker(orderId, order.makerWallet);
    if (result.count === 0) throw new ConflictError('La orden no se puede cancelar');
    await chainClient.orderbook.cancelOrder({
      orderHash: order.orderHash as `0x${string}`,
      maker: order.makerWallet as Address,
    });
    await redis.del(bookCacheKey(order.offeringId));
    return { cancelled: true };
  },

  async book(offeringId: string): Promise<OrderbookResponseDto> {
    const cached = await redis.get(bookCacheKey(offeringId));
    if (cached) return JSON.parse(cached) as OrderbookResponseDto;

    const offering = await offeringRepo.findById(offeringId);
    if (!offering) throw new NotFoundError('Oferta');
    const orders = await orderRepo.findOpenByOffering(offeringId);
    const lastPrice = await tradeRepo.lastPriceByOffering(offeringId);

    const aggregate = (side: 'buy' | 'sell'): BookLevelDto[] => {
      const levels = new Map<string, { qty: number; orderCount: number }>();
      for (const o of orders) {
        if (o.side !== side) continue;
        const remaining = Number(o.qty) - Number(o.filledQty);
        if (remaining <= 0) continue;
        const key = o.price.toString();
        const lvl = levels.get(key) ?? { qty: 0, orderCount: 0 };
        lvl.qty += remaining;
        lvl.orderCount += 1;
        levels.set(key, lvl);
      }
      return Array.from(levels.entries())
        .map(([price, v]) => ({ price, qty: v.qty.toString(), orderCount: v.orderCount }))
        .sort((a, b) =>
          side === 'buy' ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price),
        );
    };

    const response: OrderbookResponseDto = {
      offeringId,
      bids: aggregate('buy'),
      asks: aggregate('sell'),
      lastTradePrice: lastPrice?.toString() ?? null,
      updatedAt: new Date().toISOString(),
    };

    await redis.setex(bookCacheKey(offeringId), ORDERBOOK_CACHE_TTL, JSON.stringify(response));
    return response;
  },
};
