'use client';

import { useQuery } from '@tanstack/react-query';
import { apiOrMock } from '../api';
import { queryKeys } from './keys';
import { getMockPortfolio, getMockPortfolioHistory } from '../mocks/portfolio';
import { getMockTrades } from '../mocks/trades';
import { MOCK_ACTIVITY } from '../mocks/activity';
import type { PortfolioResponseDto } from '@hack/shared';

/**
 * Portfolio queries are wallet-scoped. They DO NOT run when no wallet is
 * provided — that prevents the dashboard from showing fake "Alejandro"-style
 * data while the user is logged in but hasn't connected a wallet yet.
 */
export function usePortfolio(wallet?: string) {
  return useQuery({
    queryKey: queryKeys.portfolio.by(wallet ?? 'none'),
    queryFn: () =>
      apiOrMock<PortfolioResponseDto>(`/api/portfolio/${wallet}`, () =>
        getMockPortfolio(wallet as string),
      ),
    enabled: Boolean(wallet),
  });
}

export function usePortfolioHistory(wallet?: string) {
  return useQuery({
    queryKey: queryKeys.portfolio.history(wallet ?? 'none'),
    queryFn: () =>
      apiOrMock(`/api/portfolio/${wallet}/history`, () =>
        getMockPortfolioHistory(wallet as string),
      ),
    enabled: Boolean(wallet),
  });
}

export function useMyTrades(wallet?: string) {
  return useQuery({
    queryKey: queryKeys.trades.mine(wallet ?? 'none'),
    queryFn: () =>
      apiOrMock(`/api/trades/mine?wallet=${wallet}`, () => getMockTrades(wallet as string)),
    enabled: Boolean(wallet),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: queryKeys.activity.me(),
    queryFn: () => apiOrMock(`/api/activity/me`, () => MOCK_ACTIVITY),
  });
}
