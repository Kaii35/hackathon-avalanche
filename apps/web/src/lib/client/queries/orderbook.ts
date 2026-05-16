'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiOrMock } from '../api';
import { queryKeys } from './keys';
import { makeOrderbook, getMockOpenOrders, getMockFilledOrders } from '../mocks/orders';
import { MOCK_OFFERINGS } from '../mocks/offerings';
import type { OrderbookResponseDto, OrderResponseDto } from '@hack/shared';

export function useOrderbook(offeringId: string | undefined) {
  const qc = useQueryClient();
  const offering = MOCK_OFFERINGS.find((o) => o.id === offeringId);

  const query = useQuery({
    queryKey: queryKeys.orders.book(offeringId ?? ''),
    queryFn: () =>
      apiOrMock<OrderbookResponseDto>(`/api/orders/book/${offeringId}`, () =>
        makeOrderbook(offeringId ?? '', offering?.lastTradePrice ?? 100),
      ),
    enabled: Boolean(offeringId),
  });

  // simulate realtime ticks every 2.6 s in mock mode
  useEffect(() => {
    if (!offeringId) return;
    const t = setInterval(() => {
      const cur = qc.getQueryData<OrderbookResponseDto>(queryKeys.orders.book(offeringId));
      const lastPrice = cur?.lastTradePrice
        ? Number(cur.lastTradePrice)
        : (offering?.lastTradePrice ?? 100);
      const drift = (Math.random() - 0.5) * 0.6;
      const next = makeOrderbook(offeringId, Math.max(50, lastPrice + drift));
      qc.setQueryData(queryKeys.orders.book(offeringId), next);
    }, 2600);
    return () => clearInterval(t);
  }, [offeringId, qc, offering]);

  return query;
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
      await new Promise((r) => setTimeout(r, 350));
      return { id: orderId, status: 'cancelled' as const };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      offeringId: string;
      side: 'buy' | 'sell';
      qty: string;
      price: string;
    }) => {
      await new Promise((r) => setTimeout(r, 700));
      return {
        id: `new-${Date.now()}`,
        orderHash:
          '0xnew0000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        ...input,
        status: 'open' as const,
        createdAt: new Date().toISOString(),
      };
    },
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.book(variables.offeringId) });
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}
