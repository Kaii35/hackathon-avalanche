'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiOrMock } from '../api';
import { queryKeys } from './keys';
import { MOCK_AUDIT_LOG, MOCK_INVESTORS, type MockInvestor } from '../mocks/admin';
import type { AuditLogEntryDto } from '@hack/shared';

export function useInvestors() {
  return useQuery({
    queryKey: queryKeys.admin.investors,
    queryFn: () => apiOrMock<MockInvestor[]>(`/api/admin/investors`, () => MOCK_INVESTORS),
  });
}

type AuditResponse =
  | AuditLogEntryDto[]
  | { items: AuditLogEntryDto[]; total: number; page: number; pageSize: number };

export function useAuditLog() {
  return useQuery({
    queryKey: queryKeys.admin.audit,
    queryFn: async (): Promise<AuditLogEntryDto[]> => {
      const res = await apiOrMock<AuditResponse>(`/api/admin/audit-log`, () => MOCK_AUDIT_LOG);
      // Real endpoint wraps in {items, total, page, pageSize}; mock returns a flat array.
      return Array.isArray(res) ? res : res.items;
    },
  });
}

export function useFreezeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { wallet: string; reason: string; freeze: boolean }) => {
      await new Promise((r) => setTimeout(r, 500));
      return input;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.investors });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.audit });
    },
  });
}
