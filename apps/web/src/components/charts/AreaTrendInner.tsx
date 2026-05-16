'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface AreaPoint {
  ts: string;
  value: number;
}

const numFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export function AreaTrend({
  data,
  color = '#2A5BFF',
  yLabel,
}: {
  data: AreaPoint[];
  color?: string;
  yLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          tickFormatter={(v) => format(parseISO(v), 'd MMM', { locale: es })}
          stroke="#52525b"
          fontSize={11}
          tick={{ fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke="#52525b"
          fontSize={11}
          tick={{ fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => numFmt.format(v)}
          width={56}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
          contentStyle={{
            background: 'hsl(222 18% 13%)',
            border: '1px solid hsl(222 14% 18%)',
            borderRadius: 8,
            fontSize: 12,
            color: 'hsl(0 0% 98%)',
          }}
          labelFormatter={(v) => format(parseISO(v as string), 'd MMM yyyy', { locale: es })}
          formatter={(v: number) => [numFmt.format(v), yLabel ?? 'Valor']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.6}
          fill={`url(#grad-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
