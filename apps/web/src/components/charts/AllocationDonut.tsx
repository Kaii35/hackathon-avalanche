'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { AllocationDonut as AllocationDonutType } from './AllocationDonutInner';

/**
 * Lazy wrapper around the recharts-based AllocationDonut. Same rationale
 * as [AreaTrend.tsx](./AreaTrend.tsx) — recharts is too heavy to ship in
 * the initial bundle for routes where the chart sits below the fold.
 */
const LazyAllocationDonut = dynamic(
  () => import('./AllocationDonutInner').then((m) => m.AllocationDonut),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-full bg-elevated/40" aria-hidden />
    ),
  },
) as typeof AllocationDonutType;

export function AllocationDonut(props: ComponentProps<typeof AllocationDonutType>) {
  return <LazyAllocationDonut {...props} />;
}
