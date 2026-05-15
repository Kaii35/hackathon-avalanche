'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiOrMock } from '../api';
import { queryKeys } from './keys';
import { MOCK_CAP_TABLE, MOCK_OFFERINGS, type MockOffering } from '../mocks/offerings';
import type { CapTableRowDto } from '@hack/shared';

export interface OfferingsFilters {
  status?: 'draft' | 'active' | 'closed';
  sector?: string;
  jurisdiction?: number;
  search?: string;
}

export function useOfferings(filters?: OfferingsFilters) {
  return useQuery({
    queryKey: queryKeys.offerings.list(filters as Record<string, unknown> | undefined),
    queryFn: () =>
      apiOrMock<MockOffering[]>(`/api/offerings`, () => {
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
      }),
  });
}

export function useOffering(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offerings.detail(id ?? ''),
    queryFn: () =>
      apiOrMock<MockOffering | undefined>(`/api/offerings/${id}`, () =>
        MOCK_OFFERINGS.find((o) => o.id === id),
      ),
    enabled: Boolean(id),
  });
}

export function useCapTable(offeringId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.offerings.capTable(offeringId ?? ''),
    queryFn: () =>
      apiOrMock<CapTableRowDto[]>(`/api/offerings/${offeringId}/cap-table`, () => {
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
      }),
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
