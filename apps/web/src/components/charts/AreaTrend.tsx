'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { AreaTrend as AreaTrendType } from './AreaTrendInner';

export type { AreaPoint } from './AreaTrendInner';

/**
 * Lazy wrapper around the recharts-based AreaTrend. Recharts is ~110KB
 * gzipped (with d3 + d3-shape pulled in). Loading it on demand keeps the
 * initial dashboard bundle lean — the chart appears slightly after the
 * stat cards, which is fine because it's below-the-fold on most layouts.
 */
const LazyAreaTrend = dynamic(() => import('./AreaTrendInner').then((m) => m.AreaTrend), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded bg-elevated/40" aria-hidden />,
}) as typeof AreaTrendType;

export function AreaTrend(props: ComponentProps<typeof AreaTrendType>) {
  return <LazyAreaTrend {...props} />;
}
