'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from './lib/cn';

export interface RelativeTimeProps {
  date: Date | string | number;
  className?: string;
  withTooltip?: boolean;
}

export function RelativeTime({ date, className, withTooltip = true }: RelativeTimeProps) {
  const d = typeof date === 'object' ? date : new Date(date);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (Number.isNaN(d.getTime())) {
    return <span className={cn('text-foreground-tertiary', className)}>—</span>;
  }

  const rel = formatDistanceToNowStrict(d, { addSuffix: true, locale: es });
  const abs = format(d, "d 'de' MMMM yyyy, HH:mm", { locale: es });
  return (
    <time
      dateTime={d.toISOString()}
      title={withTooltip ? abs : undefined}
      className={cn('tabular', className)}
    >
      {rel}
    </time>
  );
}
