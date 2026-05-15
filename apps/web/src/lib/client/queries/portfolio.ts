'use client';

import { useQuery } from '@tanstack/react-query';
import { apiOrMock } from '../api';
import { queryKeys } from './keys';
import { MOCK_PORTFOLIO, MOCK_PORTFOLIO_HISTORY, MOCK_WALLET } from '../mocks/portfolio';
import { MOCK_TRADES } from '../mocks/trades';
import { MOCK_ACTIVITY } from '../mocks/activity';
import type { PortfolioResponseDto } from '@hack/shared';

export function usePortfolio(wallet?: string) {
  const w = wallet ?? MOCK_WALLET;
  return useQuery({
    queryKey: queryKeys.portfolio.by(w),
    queryFn: () => apiOrMock<PortfolioResponseDto>(`/api/portfolio/${w}`, () => MOCK_PORTFOLIO),
  });
}

export function usePortfolioHistory(wallet?: string) {
  const w = wallet ?? MOCK_WALLET;
  return useQuery({
    queryKey: queryKeys.portfolio.history(w),
    queryFn: () => apiOrMock(`/api/portfolio/${w}/history`, () => MOCK_PORTFOLIO_HISTORY),
  });
}

export function useMyTrades() {
  return useQuery({
    queryKey: queryKeys.trades.mine(),
    queryFn: () => apiOrMock(`/api/trades/mine`, () => MOCK_TRADES),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: queryKeys.activity.me(),
    queryFn: () => apiOrMock(`/api/activity/me`, () => MOCK_ACTIVITY),
  });
}
