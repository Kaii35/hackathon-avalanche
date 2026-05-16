'use client';

import { useReadContracts } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import type { Address } from 'viem';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';

// -------------------------------------------------------------------------
// DTOs
// -------------------------------------------------------------------------

export type ProposalStatus = 'Pending' | 'Active' | 'Passed' | 'Defeated' | 'Tie';

// -------------------------------------------------------------------------
// Enum mappings — uint8 on-chain → TS string
// -------------------------------------------------------------------------

const STATUS_MAP: Record<number, ProposalStatus> = {
  0: 'Pending',
  1: 'Active',
  2: 'Passed',
  3: 'Defeated',
  4: 'Tie',
};

const VOTE_MAP: Record<number, 'Against' | 'For' | 'Abstain'> = {
  0: 'Against',
  1: 'For',
  2: 'Abstain',
};

export const VOTE_TO_NUM = { Against: 0, For: 1, Abstain: 2 } as const;

export interface ProposalSummary {
  proposalId: bigint;
  token: Address;
  proposedBy: Address;
  description: string;
  createdAt: bigint;
  votingDeadline: bigint;
  totalVotingPower: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  holderCount: bigint;
  /** Effective status — derived from getProposalStatus(id), not the raw struct field */
  status: ProposalStatus;
  finalized: boolean;
}

export interface VoterContext {
  proposalId: bigint;
  votingPower: bigint;
  hasVoted: boolean;
  vote: 'Against' | 'For' | 'Abstain' | null;
}

const GOVERNANCE = CONTRACT_ADDRESSES.governance;
const REFETCH_INTERVAL = 15_000;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;

// -------------------------------------------------------------------------
// Internal helper: read nextProposalId
// -------------------------------------------------------------------------

function useNextProposalId() {
  return useReadContracts({
    contracts: [
      {
        address: GOVERNANCE ?? ZERO_ADDR,
        abi: ABI.governance,
        functionName: 'nextProposalId' as const,
        chainId: avalancheFuji.id,
      },
    ],
    query: {
      enabled: Boolean(GOVERNANCE),
      refetchInterval: REFETCH_INTERVAL,
      select(data) {
        const r = data[0];
        if (!r || r.status !== 'success') return 0n;
        return r.result as bigint;
      },
    },
  });
}

// -------------------------------------------------------------------------
// useAllProposals
// -------------------------------------------------------------------------

/**
 * Reads nextProposalId, then for each i in [0, nextProposalId):
 *   - proposals(i) — full struct
 *   - getProposalStatus(i) — effective status (overrides struct.status)
 *
 * Refetches every 15 s.
 */
export function useAllProposals(): {
  data: ProposalSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch?: () => unknown;
} {
  const { data: nextIdBig, isLoading: idLoading } = useNextProposalId();
  const count = typeof nextIdBig === 'bigint' ? Number(nextIdBig) : 0;

  const proposalCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'proposals' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  const statusCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'getProposalStatus' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [...proposalCalls, ...statusCalls],
    query: {
      enabled: Boolean(GOVERNANCE) && count > 0,
      refetchInterval: REFETCH_INTERVAL,
      select(raw) {
        const results: ProposalSummary[] = [];
        for (let i = 0; i < count; i++) {
          const propResult = raw[i];
          const statusResult = raw[count + i];

          if (!propResult || propResult.status !== 'success' || !propResult.result) continue;

          // The ABI returns a tuple — viem decodes named structs as an object when using
          // named outputs, but our minimal ABI uses positional outputs so it returns an array.
          const p = propResult.result as unknown as [
            Address, // token
            Address, // proposedBy
            string, // description
            bigint, // createdAt
            bigint, // votingDeadline
            bigint, // totalVotingPower
            bigint, // forVotes
            bigint, // againstVotes
            bigint, // abstainVotes
            bigint, // holderCount
            number, // status (uint8)
            boolean, // finalized
          ];

          const effectiveStatusNum =
            statusResult?.status === 'success' ? (statusResult.result as number) : p[10];

          results.push({
            proposalId: BigInt(i),
            token: p[0],
            proposedBy: p[1],
            description: p[2],
            createdAt: p[3],
            votingDeadline: p[4],
            totalVotingPower: p[5],
            forVotes: p[6],
            againstVotes: p[7],
            abstainVotes: p[8],
            holderCount: p[9],
            status: STATUS_MAP[effectiveStatusNum] ?? 'Pending',
            finalized: p[11],
          });
        }
        return results;
      },
    },
  });

  return {
    data,
    isLoading: idLoading || isLoading,
    isError,
    refetch,
  };
}

// -------------------------------------------------------------------------
// useVoterProposals
// -------------------------------------------------------------------------

/**
 * For a given holder address, returns every proposal where votingPower > 0,
 * enriched with voter context (hasVoted, voteOf).
 */
export function useVoterProposals(holder: Address | undefined): {
  data: Array<ProposalSummary & VoterContext> | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch?: () => unknown;
} {
  const { data: nextIdBig, isLoading: idLoading } = useNextProposalId();
  const count = typeof nextIdBig === 'bigint' ? Number(nextIdBig) : 0;
  const enabled = Boolean(GOVERNANCE && holder && count > 0);
  const safeHolder = holder ?? ZERO_ADDR;

  const proposalCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'proposals' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  const statusCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'getProposalStatus' as const,
    args: [BigInt(i)] as const,
    chainId: avalancheFuji.id,
  }));

  const powerCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'votingPower' as const,
    args: [BigInt(i), safeHolder] as const,
    chainId: avalancheFuji.id,
  }));

  const votedCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'hasVoted' as const,
    args: [BigInt(i), safeHolder] as const,
    chainId: avalancheFuji.id,
  }));

  const voteOfCalls = Array.from({ length: count }, (_, i) => ({
    address: GOVERNANCE ?? ZERO_ADDR,
    abi: ABI.governance,
    functionName: 'voteOf' as const,
    args: [BigInt(i), safeHolder] as const,
    chainId: avalancheFuji.id,
  }));

  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [...proposalCalls, ...statusCalls, ...powerCalls, ...votedCalls, ...voteOfCalls],
    query: {
      enabled,
      refetchInterval: REFETCH_INTERVAL,
      select(raw) {
        const results: Array<ProposalSummary & VoterContext> = [];
        for (let i = 0; i < count; i++) {
          const propResult = raw[i];
          const statusResult = raw[count + i];
          const powerResult = raw[count * 2 + i];
          const votedResult = raw[count * 3 + i];
          const voteOfResult = raw[count * 4 + i];

          if (!propResult || propResult.status !== 'success' || !propResult.result) continue;

          const power = powerResult?.status === 'success' ? (powerResult.result as bigint) : 0n;
          // Only include proposals where this holder has voting power
          if (power === 0n) continue;

          const p = propResult.result as unknown as [
            Address,
            Address,
            string,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            number,
            boolean,
          ];

          const effectiveStatusNum =
            statusResult?.status === 'success' ? (statusResult.result as number) : p[10];

          const voted = votedResult?.status === 'success' ? (votedResult.result as boolean) : false;
          const voteNum = voteOfResult?.status === 'success' ? (voteOfResult.result as number) : 0;

          results.push({
            proposalId: BigInt(i),
            token: p[0],
            proposedBy: p[1],
            description: p[2],
            createdAt: p[3],
            votingDeadline: p[4],
            totalVotingPower: p[5],
            forVotes: p[6],
            againstVotes: p[7],
            abstainVotes: p[8],
            holderCount: p[9],
            status: STATUS_MAP[effectiveStatusNum] ?? 'Pending',
            finalized: p[11],
            // VoterContext
            votingPower: power,
            hasVoted: voted,
            vote: voted ? (VOTE_MAP[voteNum] ?? null) : null,
          });
        }
        return results;
      },
    },
  });

  return {
    data: enabled ? data : undefined,
    isLoading: idLoading || (enabled ? isLoading : false),
    isError,
    refetch,
  };
}

// -------------------------------------------------------------------------
// useVotesPendingCount
// -------------------------------------------------------------------------

/**
 * Returns the count of Active proposals where the holder has voting power
 * and has not yet voted. Used for the dashboard banner.
 */
export function useVotesPendingCount(holder: Address | undefined): {
  data: number;
  isLoading: boolean;
} {
  const { data: proposals, isLoading } = useVoterProposals(holder);

  const count = proposals?.filter((p) => p.status === 'Active' && !p.hasVoted).length ?? 0;

  return { data: count, isLoading };
}
