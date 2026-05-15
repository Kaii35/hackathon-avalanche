'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/cn';

export interface BookLevel {
  price: number;
  qty: number;
  orderCount?: number;
}

export interface OrderbookViewProps {
  bids: BookLevel[];
  asks: BookLevel[];
  lastTradePrice?: number | null;
  midPrice?: number | null;
  symbol?: string;
  className?: string;
  rows?: number;
  onLevelClick?: (side: 'bid' | 'ask', level: BookLevel) => void;
}

const numberFmt = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const qtyFmt = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function OrderbookView({
  bids,
  asks,
  lastTradePrice,
  midPrice,
  symbol,
  className,
  rows = 12,
  onLevelClick,
}: OrderbookViewProps) {
  const sortedBids = useMemo(
    () => [...bids].sort((a, b) => b.price - a.price).slice(0, rows),
    [bids, rows],
  );
  const sortedAsks = useMemo(
    () =>
      [...asks]
        .sort((a, b) => a.price - b.price)
        .slice(0, rows)
        .reverse(),
    [asks, rows],
  );

  const maxQty = Math.max(...sortedBids.map((b) => b.qty), ...sortedAsks.map((a) => a.qty), 1);

  const [priceTick, setPriceTick] = useState<{ value: number; dir: 'up' | 'down' } | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(lastTradePrice ?? null);

  useEffect(() => {
    if (lastTradePrice == null) return;
    if (prevPrice != null && lastTradePrice !== prevPrice) {
      setPriceTick({ value: lastTradePrice, dir: lastTradePrice > prevPrice ? 'up' : 'down' });
      const t = setTimeout(() => setPriceTick(null), 1200);
      setPrevPrice(lastTradePrice);
      return () => clearTimeout(t);
    }
    setPrevPrice(lastTradePrice);
  }, [lastTradePrice, prevPrice]);

  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border-subtle bg-surface', className)}
    >
      <div className="flex items-center justify-between border-b border-border-subtle bg-elevated/40 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">Libro de órdenes</h3>
        {symbol && (
          <span className="text-2xs uppercase tracking-wider text-foreground-tertiary">
            {symbol}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-border-subtle px-4 py-1.5 text-2xs uppercase tracking-wider text-foreground-tertiary">
        <span>Precio (USDC)</span>
        <span className="text-right">Cantidad</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) — top */}
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {sortedAsks.map((level, i) => {
            const total = level.price * level.qty;
            const fill = (level.qty / maxQty) * 100;
            return (
              <motion.button
                key={`ask-${level.price}-${i}`}
                type="button"
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                onClick={onLevelClick ? () => onLevelClick('ask', level) : undefined}
                className="relative grid grid-cols-3 gap-2 px-4 py-1 text-xs hover:bg-overlay/40 focus:outline-none"
              >
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-full bg-danger/10"
                  style={{ width: `${fill}%` }}
                />
                <span className="relative z-10 font-mono text-danger-fg tabular text-left">
                  {numberFmt.format(level.price)}
                </span>
                <span className="relative z-10 text-right font-mono tabular text-foreground">
                  {qtyFmt.format(level.qty)}
                </span>
                <span className="relative z-10 text-right font-mono tabular text-foreground-secondary">
                  {numberFmt.format(total)}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Mid price */}
      <div
        className={cn(
          'flex items-center justify-between border-y border-border-subtle px-4 py-2 text-sm font-mono tabular',
          priceTick?.dir === 'up' && 'animate-flash-up',
          priceTick?.dir === 'down' && 'animate-flash-down',
        )}
      >
        <span className="text-foreground-tertiary text-2xs uppercase tracking-wider">Última</span>
        <span
          className={cn(
            'text-base font-semibold',
            priceTick?.dir === 'up'
              ? 'text-success-fg'
              : priceTick?.dir === 'down'
                ? 'text-danger-fg'
                : 'text-foreground',
          )}
        >
          {lastTradePrice != null ? numberFmt.format(lastTradePrice) : '—'}
        </span>
        <span className="text-2xs text-foreground-tertiary tabular">
          {midPrice != null ? `Mid ${numberFmt.format(midPrice)}` : ''}
        </span>
      </div>

      {/* Bids (buys) — bottom */}
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {sortedBids.map((level, i) => {
            const total = level.price * level.qty;
            const fill = (level.qty / maxQty) * 100;
            return (
              <motion.button
                key={`bid-${level.price}-${i}`}
                type="button"
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                onClick={onLevelClick ? () => onLevelClick('bid', level) : undefined}
                className="relative grid grid-cols-3 gap-2 px-4 py-1 text-xs hover:bg-overlay/40 focus:outline-none"
              >
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-full bg-success/10"
                  style={{ width: `${fill}%` }}
                />
                <span className="relative z-10 font-mono text-success-fg tabular text-left">
                  {numberFmt.format(level.price)}
                </span>
                <span className="relative z-10 text-right font-mono tabular text-foreground">
                  {qtyFmt.format(level.qty)}
                </span>
                <span className="relative z-10 text-right font-mono tabular text-foreground-secondary">
                  {numberFmt.format(total)}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
