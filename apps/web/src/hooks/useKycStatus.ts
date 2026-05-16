'use client';

import { useReadContract } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';

export interface KycStatus {
  verified: boolean | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Reads IdentityRegistry.isVerified(wallet) on Avalanche Fuji.
 * Returns undefined while loading or when no wallet is connected.
 */
export function useKycStatus(address: `0x${string}` | null | undefined): KycStatus {
  const contractAddress = CONTRACT_ADDRESSES.identityRegistry;
  const enabled = Boolean(address && contractAddress);

  const { data, isLoading, isError } = useReadContract({
    address: contractAddress ?? undefined,
    abi: ABI.identityRegistry,
    functionName: 'isVerified',
    args: address ? [address] : undefined,
    chainId: avalancheFuji.id,
    query: {
      enabled,
      refetchInterval: 30_000,
      staleTime: 20_000,
    },
  });

  return {
    verified: enabled ? (data as boolean | undefined) : undefined,
    isLoading: enabled ? isLoading : false,
    isError,
  };
}
