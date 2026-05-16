'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchFujiActivity, type FujiTx } from '@/lib/client/fuji';

export function useFujiActivity(wallet: string | undefined, limit = 25) {
  return useQuery<FujiTx[]>({
    queryKey: ['fuji', 'activity', wallet ?? 'none', limit],
    queryFn: () => fetchFujiActivity(wallet as string, limit),
    enabled: Boolean(wallet),
    staleTime: 30_000, // refresh after 30s
    refetchInterval: 60_000, // poll every minute when window is focused
  });
}
