'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAccount, useSignTypedData } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { ORDER_TYPE, getDomain } from '@hack/sdk';
import { apiOrMock, api } from '../api';
import { queryKeys } from './keys';
import { makeOrderbook, getMockOpenOrders, getMockFilledOrders } from '../mocks/orders';
import { MOCK_OFFERINGS } from '../mocks/offerings';
import type { OrderbookResponseDto, OrderResponseDto } from '@hack/shared';

export function useOrderbook(offeringId: string | undefined) {
  const offering = MOCK_OFFERINGS.find((o) => o.id === offeringId);

  return useQuery({
    queryKey: queryKeys.orders.book(offeringId ?? ''),
    queryFn: () =>
      apiOrMock<OrderbookResponseDto>(`/api/orders/book/${offeringId}`, () =>
        makeOrderbook(offeringId ?? '', offering?.lastTradePrice ?? 100),
      ),
    enabled: Boolean(offeringId),
    // Real refetch replaces the mock setInterval ticker
    refetchInterval: 5000,
  });
}

/**
 * "My orders" is wallet-scoped. Disabled when no wallet is connected so the
 * dashboard doesn't show fake orders for a logged-in user without a wallet.
 */
export function useMyOrders(wallet: string | undefined, status: 'open' | 'filled' | 'all' = 'all') {
  return useQuery({
    queryKey: queryKeys.orders.mine(wallet ?? 'none', status),
    queryFn: () =>
      apiOrMock<OrderResponseDto[]>(`/api/orders/mine?status=${status}`, () => {
        const w = wallet as string;
        if (status === 'open') return getMockOpenOrders(w);
        if (status === 'filled') return getMockFilledOrders(w);
        return [...getMockOpenOrders(w), ...getMockFilledOrders(w)];
      }),
    enabled: Boolean(wallet),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      return api.call<{ id: string; status: string }>(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  return useMutation({
    mutationFn: async (input: {
      offeringId: string;
      tokenAddress: Address;
      side: 'buy' | 'sell';
      qty: string; // pretty: "100"
      price: string; // pretty: "5.50"
      expiresAtSec?: number;
    }) => {
      if (!address) throw new Error('Conecta tu wallet para firmar la orden');

      const settlementAddress = process.env.NEXT_PUBLIC_SETTLEMENT as Address | undefined;
      const paymentToken = process.env.NEXT_PUBLIC_USDC as Address | undefined;
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);

      if (!settlementAddress || !paymentToken) {
        throw new Error('Faltan NEXT_PUBLIC_SETTLEMENT o NEXT_PUBLIC_USDC en el env');
      }

      const expiresAtSec = input.expiresAtSec ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      // Random salt — prevents replay attacks
      const salt = BigInt(Math.floor(Math.random() * 1e15));

      // Base units are used ONLY for the EIP-712 payload
      const qtyBaseUnits = parseUnits(input.qty, 18);
      const priceBaseUnits = parseUnits(input.price, 6);

      const message = {
        maker: address,
        token: input.tokenAddress,
        paymentToken,
        side: input.side === 'buy' ? 0 : 1,
        qty: qtyBaseUnits,
        price: priceBaseUnits,
        expiresAt: BigInt(expiresAtSec),
        salt,
      } as const;

      const signature = await signTypedDataAsync({
        domain: getDomain(chainId, settlementAddress),
        types: ORDER_TYPE,
        primaryType: 'Order',
        message,
      });

      // Wire format uses pretty strings; backend owns unit conversion
      return api.call<OrderResponseDto>('/api/orders', {
        method: 'POST',
        body: {
          offeringId: input.offeringId,
          maker: address,
          side: input.side,
          qty: input.qty,
          price: input.price,
          expiresAt: new Date(expiresAtSec * 1000).toISOString(),
          salt: salt.toString(),
          signature,
        },
      });
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.book(vars.offeringId) });
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
