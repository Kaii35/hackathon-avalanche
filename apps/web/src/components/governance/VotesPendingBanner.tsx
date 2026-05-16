'use client';

import Link from 'next/link';
import type { Address } from 'viem';
import { Button } from '@hack/ui';
import { ArrowRight, Vote } from 'lucide-react';
import { useVotesPendingCount } from '@/hooks/useGovernance';

interface Props {
  wallet: Address;
}

/**
 * Shown on the investor dashboard when the connected wallet has Active proposals
 * where it holds voting power but has not yet cast a vote.
 */
export function VotesPendingBanner({ wallet }: Props) {
  const { data: count, isLoading } = useVotesPendingCount(wallet);

  if (isLoading || count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-info-border bg-info-bg/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <Vote className="h-5 w-5 shrink-0 text-info-fg" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          Tienes <span className="font-semibold tabular-nums">{count}</span>{' '}
          {count === 1 ? 'propuesta activa pendiente' : 'propuestas activas pendientes'} de tu voto.
        </p>
      </div>
      <Button size="sm" variant="secondary" asChild className="shrink-0">
        <Link href="/investor/governance">
          Ver propuestas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
