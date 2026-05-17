'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface Candle {
  /** Unix ms timestamp */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Notional volume in payment token (USDC) */
  volume: number;
}

interface TradingChartProps {
  data: Candle[];
  symbol: string;
  height?: number;
}

const TIMEFRAMES = ['1D', '1S', '1M', '3M', 'TODO'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// Cuántas velas mostrar por timeframe (asumiendo 1 vela por día).
const TIMEFRAME_TO_BARS: Record<Timeframe, number> = {
  '1D': 24,
  '1S': 7,
  '1M': 30,
  '3M': 90,
  TODO: Number.POSITIVE_INFINITY,
};

const UP_COLOR = '#22C55E'; // green
const DOWN_COLOR = '#EF4444'; // red
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)';
const TEXT_COLOR = 'hsl(220 8% 60%)';

function formatPrice(value: number): string {
  return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function TradingChart({ data, symbol, height = 320 }: TradingChartProps) {
  const [tf, setTf] = useState<Timeframe>('1M');

  const filtered = useMemo(() => {
    const limit = TIMEFRAME_TO_BARS[tf];
    return data.slice(Math.max(0, data.length - limit));
  }, [data, tf]);

  const { yMin, yMax } = useMemo(() => {
    if (filtered.length === 0) return { yMin: 0, yMax: 1 };
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const c of filtered) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const pad = (max - min) * 0.08;
    return { yMin: Math.max(0, min - pad), yMax: max + pad };
  }, [filtered]);

  const lastClose = filtered.at(-1)?.close ?? 0;
  const firstOpen = filtered[0]?.open ?? 0;
  const changeAbs = lastClose - firstOpen;
  const changePct = firstOpen > 0 ? (changeAbs / firstOpen) * 100 : 0;
  const totalVolume = filtered.reduce((acc, c) => acc + c.volume, 0);

  if (filtered.length === 0) {
    return (
      <div
        className="flex h-72 items-center justify-center rounded-xl border border-border-subtle bg-surface text-sm text-foreground-tertiary"
        style={{ height }}
      >
        Sin historial de precio aún para {symbol}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface">
      {/* header: timeframe + resumen */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xs uppercase tracking-wider text-foreground-tertiary">
            Periodo
          </span>
          <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-elevated p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`rounded px-2 py-0.5 text-2xs font-medium transition-colors ${
                  tf === t
                    ? 'bg-brand text-white'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-foreground-tertiary">Última</span>{' '}
            <span className="font-mono tabular text-foreground">{formatPrice(lastClose)} USDC</span>
          </div>
          <div>
            <span className="text-foreground-tertiary">Cambio</span>{' '}
            <span
              className={`font-mono tabular ${
                changeAbs >= 0 ? 'text-success-fg' : 'text-danger-fg'
              }`}
            >
              {changeAbs >= 0 ? '+' : ''}
              {formatPrice(changeAbs)} ({changePct >= 0 ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
          <div className="hidden sm:block">
            <span className="text-foreground-tertiary">Volumen</span>{' '}
            <span className="font-mono tabular text-foreground">
              {totalVolume.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* price line/area chart */}
      <div style={{ height: height * 0.72 }} className="px-2 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={changeAbs >= 0 ? UP_COLOR : DOWN_COLOR}
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor={changeAbs >= 0 ? UP_COLOR : DOWN_COLOR}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke={TEXT_COLOR}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke={TEXT_COLOR}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatPrice(v)}
              width={56}
              orientation="right"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const c = payload[0]?.payload as Candle;
                if (!c) return null;
                return (
                  <div className="rounded-md border border-border-subtle bg-elevated px-3 py-2 text-2xs shadow-md">
                    <div className="mb-1 font-mono text-foreground-tertiary">
                      {new Date(c.time).toLocaleDateString('es-MX', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
                      <dt className="text-foreground-tertiary">Precio</dt>
                      <dd className="tabular text-foreground">{formatPrice(c.close)}</dd>
                      <dt className="text-foreground-tertiary">Máximo día</dt>
                      <dd className="tabular text-success-fg">{formatPrice(c.high)}</dd>
                      <dt className="text-foreground-tertiary">Mínimo día</dt>
                      <dd className="tabular text-danger-fg">{formatPrice(c.low)}</dd>
                      <dt className="text-foreground-tertiary">Vol</dt>
                      <dd className="tabular text-foreground-secondary">
                        {c.volume.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                      </dd>
                    </dl>
                  </div>
                );
              }}
              cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={changeAbs >= 0 ? UP_COLOR : DOWN_COLOR}
              strokeWidth={2}
              fill="url(#priceGradient)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* volume chart */}
      <div style={{ height: height * 0.22 }} className="px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filtered} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Bar dataKey="volume" isAnimationActive={false}>
              {filtered.map((c, i) => (
                <Cell key={i} fill={c.close >= c.open ? UP_COLOR : DOWN_COLOR} fillOpacity={0.45} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
