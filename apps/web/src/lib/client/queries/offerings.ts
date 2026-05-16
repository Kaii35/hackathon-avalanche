'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiOrMock } from '../api';
import { queryKeys } from './keys';
import { MOCK_CAP_TABLE, MOCK_OFFERINGS, type MockOffering } from '../mocks/offerings';
import type { CapTableRowDto, OfferingResponseDto, UpdateOfferingDto } from '@hack/shared';

export interface OfferingsFilters {
  status?: 'draft' | 'active' | 'closed';
  sector?: string;
  jurisdiction?: number;
  search?: string;
  /** "Mis ofertas": API resolves the authenticated user's Issuer server-side. */
  mine?: boolean;
}

// The real API returns OfferingResponseDto which is a subset of MockOffering.
// UI components expect the rich Mock shape (trend7d, holders, lastTradePrice, ...).
// This shim fills in safe defaults so the UI never crashes when those fields are missing.
function enrichOffering(o: Partial<MockOffering> & MockOffering): MockOffering {
  return {
    ...o,
    fundedPct: o.fundedPct ?? 0,
    holders: o.holders ?? 0,
    volume24h: o.volume24h ?? 0,
    lastTradePrice: o.lastTradePrice ?? Number(o.pricePerUnit ?? 0),
    trend7d: Array.isArray(o.trend7d) && o.trend7d.length > 0 ? o.trend7d : [0, 0, 0, 0, 0, 0, 0],
    thumbnailColor: o.thumbnailColor ?? '#4F46E5',
    pricingHistory: Array.isArray(o.pricingHistory) ? o.pricingHistory : [],
    documents: Array.isArray(o.documents) ? o.documents : [],
  };
}

export function useOfferings(filters?: OfferingsFilters) {
  return useQuery({
    queryKey: queryKeys.offerings.list(filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      // Real API returns { items, total, page, pageSize }; mock returns MockOffering[].
      // Unwrap so all consumers can treat the result as a flat array.
      const qs = new URLSearchParams();
      if (filters?.mine) qs.set('mine', 'true');
      if (filters?.status) qs.set('status', filters.status);
      if (filters?.search) qs.set('search', filters.search);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const raw = await apiOrMock<MockOffering[] | { items: MockOffering[] }>(
        `/api/offerings${suffix}`,
        () => {
          let result = MOCK_OFFERINGS;
          if (filters?.status) result = result.filter((o) => o.status === filters.status);
          if (filters?.sector) result = result.filter((o) => o.sector === filters.sector);
          if (filters?.jurisdiction)
            result = result.filter((o) => o.allowedJurisdictions.includes(filters.jurisdiction!));
          if (filters?.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(
              (o) =>
                o.name.toLowerCase().includes(q) ||
                o.symbol.toLowerCase().includes(q) ||
                o.issuerName.toLowerCase().includes(q),
            );
          }
          return result;
        },
      );
      const rawList: MockOffering[] = Array.isArray(raw) ? raw : (raw?.items ?? []);
      const list = rawList.map(enrichOffering);
      if (filters?.status) return list.filter((o) => o.status === filters.status);
      return list;
    },
  });
}

export function useOffering(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offerings.detail(id ?? ''),
    queryFn: async () => {
      const raw = await apiOrMock<MockOffering | undefined>(`/api/offerings/${id}`, () =>
        MOCK_OFFERINGS.find((o) => o.id === id),
      );
      return raw ? enrichOffering(raw) : undefined;
    },
    enabled: Boolean(id),
  });
}

type CapTableResponse = CapTableRowDto[] | { offeringId: string; rows: CapTableRowDto[] };

export function useCapTable(offeringId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offerings.capTable(offeringId ?? ''),
    queryFn: async (): Promise<CapTableRowDto[]> => {
      const res = await apiOrMock<CapTableResponse>(
        `/api/offerings/${offeringId}/cap-table`,
        () => {
          return (
            MOCK_CAP_TABLE[offeringId ?? ''] ??
            // Fallback synthetic distribution
            Array.from({ length: 10 }).map((_, i) => ({
              wallet: `0x${(i + 100).toString(16).padStart(40, '0')}` as `0x${string}`,
              balance: ((10 - i) * 250000).toString(),
              percentOfTotal: (10 - i) * 1.2,
              lastUpdatedBlock: (1284500 - i * 7).toString(),
            }))
          );
        },
      );
      // Real endpoint wraps in {offeringId, rows}; mock returns a flat array.
      return Array.isArray(res) ? res : res.rows;
    },
    enabled: Boolean(offeringId),
  });
}

export function useCreateOffering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      // mock-only: pretend success
      await new Promise((r) => setTimeout(r, 600));
      return { id: `new-${Date.now()}`, ...input };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.offerings.all });
    },
  });
}

export function useUpdateOffering(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOfferingDto) => {
      if (!id) throw new Error('Missing offering id');
      return await api.call<OfferingResponseDto>(`/api/offerings/${id}`, {
        method: 'PATCH',
        body: input,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.offerings.all });
      if (id) void qc.invalidateQueries({ queryKey: queryKeys.offerings.detail(id) });
    },
  });
}
