'use client';

import { useAccount, useBalance } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

// USDC token used by the platform. Prefer NEXT_PUBLIC_USDC (our MockUSDC
// deployed for the demo) and fall back to Circle's official USDC on Fuji
// only if the env var is missing.
const USDC_FUJI = (process.env.NEXT_PUBLIC_USDC ??
  '0x5425890298aed601595a70AB815c96711a31Bc65') as `0x${string}`;

export interface WalletBalances {
  isConnected: boolean;
  isCorrectChain: boolean;
  address: `0x${string}` | undefined;
  avax: {
    formatted: string;
    value: bigint;
    symbol: string;
    isLoading: boolean;
  };
  usdc: {
    formatted: string;
    value: bigint;
    symbol: string;
    isLoading: boolean;
  };
}

/**
 * Reads real balances directly from Avalanche Fuji RPC for the connected wallet.
 * Returns formatted strings ready to display, plus raw bigints for math.
 */
export function useWalletBalances(): WalletBalances {
  const { address, isConnected, chainId } = useAccount();
  const isCorrectChain = chainId === avalancheFuji.id;

  const avaxQuery = useBalance({
    address,
    chainId: avalancheFuji.id,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const usdcQuery = useBalance({
    address,
    token: USDC_FUJI,
    chainId: avalancheFuji.id,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  return {
    isConnected,
    isCorrectChain,
    address,
    avax: {
      formatted: avaxQuery.data?.formatted ?? '0',
      value: avaxQuery.data?.value ?? 0n,
      symbol: avaxQuery.data?.symbol ?? 'AVAX',
      isLoading: avaxQuery.isLoading,
    },
    usdc: {
      formatted: usdcQuery.data?.formatted ?? '0',
      value: usdcQuery.data?.value ?? 0n,
      symbol: usdcQuery.data?.symbol ?? 'USDC',
      isLoading: usdcQuery.isLoading,
    },
  };
}
