'use client';

import { useAccount, useBalance } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';

// Circle-issued USDC on Avalanche Fuji testnet.
// https://developers.circle.com/stablecoins/usdc-on-test-networks
const USDC_FUJI = '0x5425890298aed601595a70AB815c96711a31Bc65' as const;

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
