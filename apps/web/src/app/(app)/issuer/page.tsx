'use client';

import { Badge, Button, ChartCard, MetricGrid, PageHeader, Progress, StatCard } from '@hack/ui';
import { Building2, Coins, PlusCircle, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { useOfferings } from '@/lib/client/queries/offerings';
import { useSession } from '@/lib/client/queries/session';

export default function IssuerDashboard() {
  const { data: session } = useSession();
  // "mine: true" → el backend resuelve server-side el Issuer del usuario
  // autenticado. Antes filtrábamos por un issuerId hardcoded del mock, lo que
  // dejaba en cero el dashboard para cualquier emisor distinto a Arkangeles.
  const { data: offerings } = useOfferings({ mine: true });
  const myOfferings = offerings ?? [];

  // Título: nombre del dueño de la wallet si está registrado, si no el
  // username del email (parte antes de la @). `displayName` viene resuelto
  // así desde el backend — ver auth.service.ts.
  const dashboardTitle = session?.displayName ?? session?.email?.split('@')[0] ?? 'Mi dashboard';
  const totalRaised = myOfferings.reduce(
    (acc, o) => acc + (Number(o.totalSupply) * Number(o.pricePerUnit) * o.fundedPct) / 100,
    0,
  );
  const totalHolders = myOfferings.reduce((acc, o) => acc + o.holders, 0);
  const volumeMonth = 4_280_000;

  const fundingHistory = Array.from({ length: 60 }).map((_, i) => ({
    ts: new Date(Date.now() - (59 - i) * 86400000).toISOString(),
    value: 18_000_000 + i * 240_000 + Math.sin(i / 5) * 320_000,
  }));

  return (
    <>
      <PageHeader
        title={dashboardTitle}
        description="Vista del emisor: ofertas, holders y volumen secundario."
        meta={
          <Badge variant="success">
            <Building2 className="h-3 w-3" />
            Licencia CNBV vigente
          </Badge>
        }
        actions={
          <Button asChild>
            <Link href="/issuer/offerings/new">
              <PlusCircle className="h-4 w-4" />
              Nueva oferta
            </Link>
          </Button>
        }
      />

      <MetricGrid>
        <StatCard
          label="Capital levantado"
          value={`$${totalRaised.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
          delta={6.2}
          deltaLabel="MXN equivalente"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Ofertas activas"
          value={myOfferings.filter((o) => o.status === 'active').length}
          helper={`${myOfferings.length} totales`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          label="Holders únicos"
          value={totalHolders.toLocaleString('es-MX')}
          delta={3.8}
          deltaLabel="vs. mes pasado"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Volumen secundario 30d"
          value={`$${volumeMonth.toLocaleString('es-MX')}`}
          delta={12.1}
          deltaLabel="USDC liquidado"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Funding velocity"
          helper="Capital fondeado acumulado · 60 días"
          className="lg:col-span-2"
        >
          <AreaTrend data={fundingHistory} color="#10B981" yLabel="MXN" />
        </ChartCard>

        <ChartCard title="Avance por oferta" helper="Fondeo vs. supply">
          <ul className="space-y-4">
            {myOfferings.map((o) => (
              <li key={o.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <Link
                    href={`/issuer/offerings/${o.id}`}
                    className="font-medium text-foreground hover:text-brand-400"
                  >
                    {o.symbol}
                  </Link>
                  <span className="tabular text-foreground-secondary">{o.fundedPct}%</span>
                </div>
                <Progress
                  value={o.fundedPct}
                  tone={o.fundedPct >= 90 ? 'success' : o.fundedPct >= 60 ? 'brand' : 'warning'}
                />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </>
  );
}
