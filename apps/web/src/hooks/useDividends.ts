'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import type { Address } from 'viem';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';

export interface DividendSummary {
  dividendId: bigint;
  token: Address;
  paymentToken: Address;
  declaredBy: Address;
  totalAmount: bigint;
  totalClaimed: bigint;
  declaredAt: bigint;
  holderCount: bigint;
}

export interface ClaimableDividend {
  dividendId: bigint;
  token: Address;
  paymentToken: Address;
  /** claimable amount in base units (0 when already claimed) */
  amount: bigint;
  claimed: boolean;
}

const DISTRIBUTOR = CONTRACT_ADDRESSES.dividendDistributor;
const REFETCH_INTERVAL = 15_000;

/**
 * Reads nextDividendId from the DividendDistributor.
 * Used internally to know the range of dividend IDs to query.
 */
function useNextDividendId() {
  return useReadContract({
    address: DISTRIBUTOR ?? undefined,
    abi: ABI.dividendDistributor,
    functionName: 'nextDividendId',
    chainId: avalancheFuji.id,
    query: {
      enabled: Boolean(DISTRIBUTOR),
      refetchInterval: REFETCH_INTERVAL,
    },
  });
}

/**
 * Returns a summary of all declared dividends by reading dividends(i) for each i in [0, nextDividendId).
 * Uses multicall via useReadContracts to batch all reads in a single RPC call.
 */
export function useAllDividends() {
  const { data: nextId } = useNextDividendId();
  const count = typeof nextId === 'bigint' ? Number(nextId) : 0;

  const contracts = Array.from({ length: count }, (_, i) => ({
    address: DISTRIBUTOR ?? ('0x' as Address),
    abi: ABI.dividendDistributor,
    functionName: 'dividends' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  return useReadContracts({
    contracts,
    query: {
      enabled: Boolean(DISTRIBUTOR) && count > 0,
      refetchInterval: REFETCH_INTERVAL,
      select(data) {
        const results: DividendSummary[] = [];
        for (let i = 0; i < data.length; i++) {
          const r = data[i];
          if (!r || r.status !== 'success' || !r.result) continue;
          const raw = r.result as unknown as [
            Address,
            Address,
            Address,
            bigint,
            bigint,
            bigint,
            bigint,
          ];
          const [
            token,
            paymentToken,
            declaredBy,
            totalAmount,
            totalClaimed,
            declaredAt,
            holderCount,
          ] = raw;
          results.push({
            dividendId: BigInt(i),
            token,
            paymentToken,
            declaredBy,
            totalAmount,
            totalClaimed,
            declaredAt,
            holderCount,
          });
        }
        return results;
      },
    },
  });
}

/**
 * For a given holder, returns all dividends where they have an allocation,
 * along with whether it has been claimed.
 * Reads allocation(i, holder) and claimed(i, holder) for each dividend ID.
 */
export function useClaimableDividends(holder: Address | undefined) {
  const { data: nextId } = useNextDividendId();
  const count = typeof nextId === 'bigint' ? Number(nextId) : 0;

  // Build parallel multicall: for each dividendId, query allocation + claimed + dividend summary
  const allocationCalls = Array.from({ length: count }, (_, i) => ({
    address: DISTRIBUTOR ?? ('0x' as Address),
    abi: ABI.dividendDistributor,
    functionName: 'allocation' as const,
    args: [BigInt(i), holder ?? '0x0000000000000000000000000000000000000000'] as const,
    chainId: avalancheFuji.id,
  }));

  const claimedCalls = Array.from({ length: count }, (_, i) => ({
    address: DISTRIBUTOR ?? ('0x' as Address),
    abi: ABI.dividendDistributor,
    functionName: 'claimed' as const,
    args: [BigInt(i), holder ?? '0x0000000000000000000000000000000000000000'] as const,
    chainId: avalancheFuji.id,
  }));

  const dividendCalls = Array.from({ length: count }, (_, i) => ({
    address: DISTRIBUTOR ?? ('0x' as Address),
    abi: ABI.dividendDistributor,
    functionName: 'dividends' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  const contracts = [...allocationCalls, ...claimedCalls, ...dividendCalls];

  return useReadContracts({
    contracts,
    query: {
      enabled: Boolean(DISTRIBUTOR && holder && count > 0),
      refetchInterval: REFETCH_INTERVAL,
      select(data) {
        const results: ClaimableDividend[] = [];
        for (let i = 0; i < count; i++) {
          const alloc = data[i];
          const claim = data[count + i];
          const div = data[count * 2 + i];

          if (
            alloc?.status !== 'success' ||
            claim?.status !== 'success' ||
            div?.status !== 'success'
          )
            continue;

          const amount = alloc.result as bigint;
          if (amount === 0n) continue; // holder has no allocation for this dividend

          const isClaimed = claim.result as boolean;
          const divRaw = div.result as unknown as [Address, Address, ...unknown[]];
          const [token, paymentToken] = divRaw;

          results.push({
            dividendId: BigInt(i),
            token,
            paymentToken,
            amount: isClaimed ? 0n : amount,
            claimed: isClaimed,
          });
        }
        return results;
      },
    },
  });
}

/**
 * Returns the total USDC claimable (not yet claimed) across all dividends for a given holder.
 * Suitable for the dashboard banner.
 */
// Explicit return type so the build doesn't try (and fail) to serialise a
// type reference into the pnpm-virtual @wagmi/core path, which isn't a
// portable identifier in declaration output.
export function useTotalClaimable(holder: Address | undefined): {
  data: bigint;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const { data: claimable, isLoading, isError, error } = useClaimableDividends(holder);

  const total = claimable?.reduce((acc, c) => (c.claimed ? acc : acc + c.amount), 0n) ?? 0n;

  return { data: total, isLoading, isError, error: error as Error | null };
}
