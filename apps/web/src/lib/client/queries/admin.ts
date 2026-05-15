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

export function useAuditLog() {
  return useQuery({
    queryKey: queryKeys.admin.audit,
    queryFn: () => apiOrMock<AuditLogEntryDto[]>(`/api/admin/audit-log`, () => MOCK_AUDIT_LOG),
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
