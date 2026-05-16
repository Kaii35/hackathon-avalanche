'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { SessionUser } from '@hack/shared';
import { api, ApiError } from '../api';

export const SESSION_KEY = ['session'] as const;

export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        const res = await api.call<{ user: SessionUser | null }>('/api/auth/session');
        return res.user ?? null;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.call('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore network errors on logout
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, null);
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}
