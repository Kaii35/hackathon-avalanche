import { cn } from './lib/cn';

export interface PercentProps {
  value: number;
  decimals?: number;
  signed?: boolean;
  colored?: boolean;
  className?: string;
}

const cache = new Map<string, Intl.NumberFormat>();
function fmt(decimals: number, signed: boolean) {
  const key = `${decimals}|${signed}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      signDisplay: signed ? 'always' : 'auto',
    });
    cache.set(key, f);
  }
  return f;
}

export function Percent({
  value,
  decimals = 2,
  signed = false,
  colored = false,
  className,
}: PercentProps) {
  const v = value / 100;
  const text = Number.isFinite(v) ? fmt(decimals, signed).format(v) : '—';
  const tone = colored
    ? value > 0
      ? 'text-success-fg'
      : value < 0
        ? 'text-danger-fg'
        : 'text-foreground-secondary'
    : '';
  return <span className={cn('tabular', tone, className)}>{text}</span>;
}
