'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminInviteDto, CreateAdminInviteDto } from '@hack/shared';
import { api } from '../api';
import { queryKeys } from './keys';

export function useAdminInvites() {
  return useQuery<AdminInviteDto[]>({
    queryKey: queryKeys.admin.invites,
    queryFn: () => api.call<AdminInviteDto[]>('/api/admin/invites'),
    staleTime: 10_000,
  });
}

export function useCreateAdminInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAdminInviteDto) =>
      api.call<AdminInviteDto>('/api/admin/invites', { method: 'POST', body: dto }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.invites });
    },
  });
}

export function useRevokeAdminInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.call<AdminInviteDto>(`/api/admin/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.invites });
    },
  });
}
