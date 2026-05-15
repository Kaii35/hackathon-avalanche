import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
  meta?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  meta,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Migas de pan">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-foreground-tertiary">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {b.href ? (
                  <a
                    href={b.href}
                    className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                  >
                    {b.label}
                  </a>
                ) : (
                  <span className="text-foreground-secondary">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span aria-hidden="true">/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-foreground-secondary">{description}</p>
          )}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
