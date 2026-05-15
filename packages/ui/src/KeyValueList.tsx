import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  className?: string;
  layout?: 'rows' | 'grid';
  divided?: boolean;
}

export function KeyValueList({
  items,
  className,
  layout = 'rows',
  divided = true,
}: KeyValueListProps) {
  if (layout === 'grid') {
    return (
      <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3', className)}>
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wider text-foreground-tertiary">
              {item.label}
            </dt>
            <dd className="text-sm font-medium text-foreground tabular">{item.value}</dd>
            {item.helper && <dd className="text-xs text-foreground-tertiary">{item.helper}</dd>}
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn('w-full', className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            'flex flex-wrap items-baseline justify-between gap-2 py-3',
            divided && idx > 0 && 'border-t border-border-subtle',
          )}
        >
          <dt className="text-sm text-foreground-secondary">{item.label}</dt>
          <dd className="text-sm font-medium text-foreground tabular text-right">
            {item.value}
            {item.helper && (
              <div className="text-xs text-foreground-tertiary mt-0.5">{item.helper}</div>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
