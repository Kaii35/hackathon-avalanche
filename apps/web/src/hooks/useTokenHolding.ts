'use client';

import { useReadContracts } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { ABI } from '@/lib/client/contracts';

export interface TokenHolding {
  balance: bigint | undefined;
  symbol: string | undefined;
  decimals: number | undefined;
  /** Human-readable balance string using es-MX locale. */
  formatted: string | undefined;
  isLoading: boolean;
  isError: boolean;
}

function formatBalance(raw: bigint, decimals: number): string {
  // Divide by 10^decimals using BigInt math, then format with Intl.
  if (decimals === 0) {
    return new Intl.NumberFormat('es-MX').format(raw);
  }
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;

  // Build fractional string with leading zeros preserved.
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const num = fracStr ? Number(`${whole}.${fracStr}`) : Number(whole);

  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 6),
  }).format(num);
}

/**
 * Reads balanceOf, symbol, and decimals for a given ERC-20 token and wallet
 * in parallel using a single multicall. Returns a formatted balance string.
 */
export function useTokenHolding(
  tokenAddress: `0x${string}` | null | undefined,
  walletAddress: `0x${string}` | null | undefined,
): TokenHolding {
  const enabled = Boolean(tokenAddress && walletAddress);

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      {
        address: tokenAddress ?? undefined,
        abi: ABI.erc20,
        functionName: 'balanceOf',
        args: walletAddress ? [walletAddress] : undefined,
        chainId: avalancheFuji.id,
      },
      {
        address: tokenAddress ?? undefined,
        abi: ABI.erc20,
        functionName: 'symbol',
        chainId: avalancheFuji.id,
      },
      {
        address: tokenAddress ?? undefined,
        abi: ABI.erc20,
        functionName: 'decimals',
        chainId: avalancheFuji.id,
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
      staleTime: 10_000,
    },
  });

  const balanceResult = data?.[0];
  const symbolResult = data?.[1];
  const decimalsResult = data?.[2];

  const balance =
    balanceResult?.status === 'success' ? (balanceResult.result as bigint) : undefined;
  const symbol = symbolResult?.status === 'success' ? (symbolResult.result as string) : undefined;
  const decimals =
    decimalsResult?.status === 'success' ? (decimalsResult.result as number) : undefined;

  const formatted =
    balance !== undefined && decimals !== undefined ? formatBalance(balance, decimals) : undefined;

  return {
    balance,
    symbol,
    decimals,
    formatted,
    isLoading: enabled ? isLoading : false,
    isError,
  };
}
