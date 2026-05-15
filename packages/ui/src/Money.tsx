import { cn } from './lib/cn';

export interface MoneyProps {
  value: number | string;
  currency?: 'MXN' | 'USDC' | 'USD';
  decimals?: number;
  className?: string;
  compact?: boolean;
  signed?: boolean;
  symbol?: boolean;
}

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, decimals: number, compact: boolean, signed: boolean) {
  const key = `${currency}|${decimals}|${compact}|${signed}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-MX', {
      style: 'decimal',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
      signDisplay: signed ? 'always' : 'auto',
    });
    formatters.set(key, f);
  }
  return f;
}

export function Money({
  value,
  currency = 'MXN',
  decimals = 2,
  className,
  compact = false,
  signed = false,
  symbol = true,
}: MoneyProps) {
  const num = typeof value === 'string' ? Number(value) : value;
  const display = Number.isFinite(num)
    ? getFormatter(currency, decimals, compact, signed).format(num)
    : '—';
  const symbolText = currency === 'MXN' ? '$' : currency === 'USDC' ? '' : '$';
  const suffix = currency === 'USDC' ? ' USDC' : currency === 'MXN' ? ' MXN' : '';

  return (
    <span className={cn('tabular', className)}>
      {symbol && symbolText}
      {display}
      {symbol && suffix}
    </span>
  );
}
