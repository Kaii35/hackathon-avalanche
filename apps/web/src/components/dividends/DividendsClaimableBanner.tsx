'use client';

import Link from 'next/link';
import { formatUnits, type Address } from 'viem';
import { Button } from '@hack/ui';
import { ArrowRight, Coins } from 'lucide-react';
import { useTotalClaimable } from '@/hooks/useDividends';

interface Props {
  wallet: Address;
}

/**
 * Shows a banner when the connected wallet has unclaimed USDC dividends.
 * Renders nothing if total claimable is 0.
 */
export function DividendsClaimableBanner({ wallet }: Props) {
  const { data: total, isLoading } = useTotalClaimable(wallet);

  if (isLoading || !total || total === 0n) return null;

  const formatted = Number(formatUnits(total, 6)).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <Coins className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          Tienes <span className="font-semibold tabular-nums">{formatted} USDC</span> pendientes de
          reclamar de Arkangeles.
        </p>
      </div>
      <Button size="sm" variant="secondary" asChild className="shrink-0">
        <Link href="/investor/dividends">
          Reclamar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
