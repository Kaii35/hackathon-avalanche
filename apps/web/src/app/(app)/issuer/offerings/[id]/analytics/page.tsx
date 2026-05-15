'use client';

import { use } from 'react';
import { ChartCard, MetricGrid, PageHeader, Skeleton, StatCard } from '@hack/ui';
import { useOffering } from '@/lib/client/queries/offerings';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);

  if (!offering) return <Skeleton className="h-screen w-full" />;

  const fundingHistory = Array.from({ length: 60 }).map((_, i) => ({
    ts: new Date(Date.now() - (59 - i) * 86400000).toISOString(),
    value: i * 32_000 + 280_000 + Math.sin(i / 4) * 18_000,
  }));

  const volumeBars = Array.from({ length: 14 }).map((_, i) => ({
    day: `D${i + 1}`,
    volume: 80_000 + Math.random() * 320_000 + i * 6_000,
  }));

  const geoData = [
    { region: 'CDMX', holders: 88 },
    { region: 'Monterrey', holders: 64 },
    { region: 'Guadalajara', holders: 41 },
    { region: 'Querétaro', holders: 28 },
    { region: 'Mérida', holders: 22 },
    { region: 'Otros', holders: 69 },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Mis ofertas', href: '/issuer/offerings' },
          { label: offering.name, href: `/issuer/offerings/${id}` },
          { label: 'Analytics' },
        ]}
        title={`Analytics · ${offering.symbol}`}
        description="Velocidad de fondeo, volumen secundario, crecimiento de holders y distribución geográfica."
      />

      <MetricGrid>
        <StatCard label="Capital fondeado" value={`${offering.fundedPct}%`} delta={4.2} />
        <StatCard label="Holders nuevos 30d" value="42" delta={8.1} />
        <StatCard
          label="Volumen secundario 30d"
          value={`$${(offering.volume24h * 30).toLocaleString('es-MX')}`}
          delta={12.4}
        />
        <StatCard label="Tasa de retención 90d" value="94%" delta={1.2} />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Funding velocity" helper="Capital fondeado · 60 días">
          <AreaTrend data={fundingHistory} color="#10B981" yLabel="USDC" />
        </ChartCard>

        <ChartCard title="Volumen secundario" helper="Últimos 14 días">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeBars} margin={{ top: 8, right: 6, bottom: 0, left: -10 }}>
              <XAxis
                dataKey="day"
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
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: 'hsl(222 18% 13%)',
                  border: '1px solid hsl(222 14% 18%)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(0 0% 98%)',
                }}
                formatter={(v: number) => [
                  `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`,
                  'Volumen',
                ]}
              />
              <Bar dataKey="volume" fill="#E84142" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Distribución geográfica"
          helper="Holders por región"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={geoData}
              layout="vertical"
              margin={{ top: 8, right: 12, bottom: 8, left: 30 }}
            >
              <XAxis
                type="number"
                stroke="#52525b"
                fontSize={11}
                tick={{ fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="region"
                stroke="#52525b"
                fontSize={11}
                tick={{ fill: '#a1a1aa' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: 'hsl(222 18% 13%)',
                  border: '1px solid hsl(222 14% 18%)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'hsl(0 0% 98%)',
                }}
              />
              <Bar dataKey="holders" fill="#3B82F6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
