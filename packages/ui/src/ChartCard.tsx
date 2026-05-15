import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { cn } from './lib/cn';

export interface ChartCardProps {
  title: ReactNode;
  helper?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  empty?: boolean;
  emptyState?: ReactNode;
  loading?: boolean;
}

export function ChartCard({
  title,
  helper,
  actions,
  children,
  className,
  bodyClassName,
  empty,
  emptyState,
  loading,
}: ChartCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          {helper && <p className="text-xs text-foreground-tertiary">{helper}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('h-64', bodyClassName)}>
        {loading ? (
          <div className="h-full w-full shimmer rounded-md" />
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-foreground-tertiary">
            {emptyState ?? 'Sin datos.'}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
