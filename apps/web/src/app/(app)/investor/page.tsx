'use client';

import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
  MetricGrid,
  PageHeader,
  Skeleton,
  StatCard,
  WalletAddress,
} from '@hack/ui';
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Coins,
  Star,
  Wallet as WalletIcon,
} from 'lucide-react';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { OfferingCard } from '@/components/offerings/OfferingCard';
import { useOfferings } from '@/lib/client/queries/offerings';
import { usePortfolio, usePortfolioHistory, useActivity } from '@/lib/client/queries/portfolio';
import { useWallet } from '@/hooks/useWallet';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InvestorDashboard() {
  const { address } = useWallet();
  const { data: portfolio } = usePortfolio();
  const { data: history } = usePortfolioHistory();
  const { data: offerings } = useOfferings({ status: 'active' });
  const { data: activity } = useActivity();

  const totalValue = Number(portfolio?.totalMarketValue ?? 0);
  const previousValue =
    history && history.length > 30
      ? (history[history.length - 31]?.value ?? totalValue)
      : totalValue;
  const delta30 = previousValue ? ((totalValue - previousValue) / previousValue) * 100 : 0;
  const recommended = (offerings ?? []).slice(0, 3);

  return (
    <>
      <PageHeader
        title={<>Hola, Alejandro 👋</>}
        description="Vista rápida de tu portafolio y oportunidades para hoy."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success" />
              KYC verificado
            </Badge>
            <WalletAddress
              address={address}
              className="rounded-md border border-border-subtle bg-surface px-2 py-1"
            />
          </div>
        }
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/investor/portfolio">
                Ver portafolio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild>
              <Link href="/investor/offerings">
                Explorar mercado
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <MetricGrid>
        <StatCard
          label="Valor del portafolio"
          value={`$${totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`}
          delta={delta30}
          deltaLabel="vs. 30 días"
          trend={(history ?? []).slice(-30).map((p) => p.value)}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Posiciones activas"
          value={portfolio?.positions.length ?? 0}
          helper="Diversificadas en 4 ofertas"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Watchlist"
          value="6"
          helper="3 ofertas con cambios hoy"
          icon={<Star className="h-4 w-4" />}
        />
        <StatCard
          label="Próximo vencimiento"
          value="Sep 2026"
          helper="Crédito PYME Series A · lockup"
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Valor del portafolio"
          helper="Últimos 90 días — MXN"
          className="lg:col-span-2"
        >
          {history ? (
            <AreaTrend data={history.map((p) => ({ ts: p.ts, value: p.value }))} yLabel="Valor" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </ChartCard>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Actividad reciente</CardTitle>
            <Button variant="link" size="xs" asChild>
              <Link href="/investor/activity">Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-3">
            <ul className="divide-y divide-border-subtle">
              {(activity ?? []).slice(0, 5).map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 px-3 py-3">
                  <span className="mt-1 grid h-7 w-7 place-items-center rounded-full bg-elevated text-foreground-tertiary">
                    <WalletIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{ev.title}</p>
                    <p className="line-clamp-2 text-xs text-foreground-tertiary">
                      {ev.description}
                    </p>
                    <p className="mt-1 text-2xs text-foreground-tertiary">
                      {format(new Date(ev.ts), 'd MMM, HH:mm', { locale: es })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Ofertas recomendadas</h2>
          <Button variant="link" size="xs" asChild>
            <Link href="/investor/offerings">Ver todas las ofertas</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recommended.map((o) => (
            <OfferingCard key={o.id} offering={o} />
          ))}
        </div>
      </section>
    </>
  );
}
