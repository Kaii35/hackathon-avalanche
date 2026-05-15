import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { cn } from './lib/cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  delta?: number;
  deltaLabel?: string;
  trend?: number[];
  icon?: ReactNode;
  className?: string;
  loading?: boolean;
}

function formatDelta(d: number) {
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(2)}%`;
}

export function StatCard({
  label,
  value,
  helper,
  delta,
  deltaLabel,
  trend,
  icon,
  className,
  loading,
}: StatCardProps) {
  const isUp = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-5',
        'transition-colors hover:border-border',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
            {label}
          </p>
          {loading ? (
            <div className="h-7 w-32 shimmer rounded-md" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight text-foreground tabular">{value}</p>
          )}
          {helper && <p className="text-xs text-foreground-tertiary">{helper}</p>}
        </div>
        {icon && <div className="text-foreground-tertiary">{icon}</div>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular',
              isUp ? 'text-success-fg' : 'text-danger-fg',
            )}
          >
            {isUp ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatDelta(delta)}
            {deltaLabel && <span className="text-foreground-tertiary ml-1">{deltaLabel}</span>}
          </span>
        )}
        {trend && trend.length > 1 && <Sparkline data={trend} width={80} height={24} />}
      </div>
    </div>
  );
}
