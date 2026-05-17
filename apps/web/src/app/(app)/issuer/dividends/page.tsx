'use client';

import { useMemo } from 'react';
import { formatUnits, type Address } from 'viem';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MetricGrid,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
} from '@hack/ui';
import { CalendarClock, CheckCircle2, Coins, ExternalLink, TrendingUp, Users } from 'lucide-react';
import { DeclareDividendPanel } from '@/components/dividends/DeclareDividendPanel';
import { useAllDividends, type DividendSummary } from '@/hooks/useDividends';
import { CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { useWallet } from '@/hooks/useWallet';
import { useOfferings } from '@/lib/client/queries/offerings';

const SNOWSCAN_ADDR = (addr: string) => `https://testnet.snowscan.xyz/address/${addr}`;
const USDC_DECIMALS = 6;

function fmtUsdc(v: bigint): string {
  return Number(formatUnits(v, USDC_DECIMALS)).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUsdcRaw(v: bigint): number {
  return Number(formatUnits(v, USDC_DECIMALS));
}

function fmtDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(unixSeconds) * 1000));
}

/** Card por oferta — agrupa eventos del issuer por token y muestra KPIs. */
function OfferingDividendBlock({
  offeringName,
  offeringSymbol,
  tokenAddress,
  totalSupply,
  expectedAnnualReturn,
  events,
}: {
  offeringName: string;
  offeringSymbol: string;
  tokenAddress: Address;
  totalSupply: number;
  expectedAnnualReturn: number | undefined;
  events: DividendSummary[];
}) {
  const totalDistributed = events.reduce((acc, e) => acc + e.totalAmount, 0n);
  const totalClaimed = events.reduce((acc, e) => acc + e.totalClaimed, 0n);
  const totalPending = totalDistributed - totalClaimed;
  const claimRate = totalDistributed > 0n ? Number((totalClaimed * 100n) / totalDistributed) : 0;

  // DPS promedio = USDC total / supply total (aprox: asume supply estable).
  const avgDps =
    totalSupply > 0 && totalDistributed > 0n ? fmtUsdcRaw(totalDistributed) / totalSupply : 0;

  // Próxima fecha sugerida: último declaredAt + 90 días (trimestral) por default,
  // o 365 / 4 si tenemos expectedAnnualReturn declarado (mismo cadencia).
  const lastDeclared = events[events.length - 1]?.declaredAt;
  const projectedNext = lastDeclared ? new Date((Number(lastDeclared) + 90 * 86_400) * 1000) : null;

  return (
    <Card>
      <CardHeader className="border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {offeringName} <span className="text-foreground-tertiary">· {offeringSymbol}</span>
            </CardTitle>
            <p className="text-2xs text-foreground-tertiary">
              <span className="font-mono">
                {tokenAddress.slice(0, 6)}…{tokenAddress.slice(-4)}
              </span>
              {' · '}
              Supply: {totalSupply.toLocaleString('es-MX')} {offeringSymbol}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Distribuido lifetime
            </p>
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {fmtUsdc(totalDistributed)} USDC
            </p>
            <p className="text-2xs text-foreground-tertiary tabular-nums">
              {events.length} evento{events.length === 1 ? '' : 's'} · DPS prom {avgDps.toFixed(4)}{' '}
              USDC/{offeringSymbol}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">Claim rate</p>
            <Progress
              value={claimRate}
              tone={claimRate >= 80 ? 'success' : claimRate >= 40 ? 'warning' : 'brand'}
            />
            <p className="text-2xs text-foreground-tertiary tabular-nums">
              {claimRate}% de tus holders ya cobró
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              USDC pendiente en pool
            </p>
            <p className="text-sm font-semibold tabular-nums text-warning-fg">
              {fmtUsdc(totalPending)} USDC
            </p>
            <p className="text-2xs text-foreground-tertiary">
              Pasivo abierto hasta que cada holder reclame
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Próxima fecha sugerida
            </p>
            <p className="text-sm tabular-nums text-foreground-secondary">
              <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
              {projectedNext
                ? projectedNext.toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </p>
            {expectedAnnualReturn !== undefined && (
              <p className="text-2xs text-foreground-tertiary">
                APY ofrecido: {expectedAnnualReturn.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {events.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-foreground-secondary">
            Aún no has declarado dividendos para esta oferta. Usa el panel de la derecha para el
            primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated/40">
                <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">DPS</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reclamado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Holders</th>
                  <th className="px-4 py-2.5 text-left font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {[...events]
                  .sort((a, b) => (b.declaredAt > a.declaredAt ? 1 : -1))
                  .map((e) => {
                    const pct =
                      e.totalAmount > 0n ? Number((e.totalClaimed * 100n) / e.totalAmount) : 0;
                    const dps = totalSupply > 0 ? fmtUsdcRaw(e.totalAmount) / totalSupply : 0;
                    return (
                      <tr
                        key={e.dividendId.toString()}
                        className="transition-colors hover:bg-elevated/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{fmtDate(e.declaredAt)}</span>
                            <span className="font-mono text-2xs text-foreground-tertiary">
                              #{e.dividendId.toString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtUsdc(e.totalAmount)} USDC
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground-secondary">
                          {dps > 0 ? (
                            <span title="USDC pagado por cada token en circulación">
                              {dps.toLocaleString('es-MX', {
                                minimumFractionDigits: 4,
                                maximumFractionDigits: 4,
                              })}{' '}
                              USDC/{offeringSymbol}
                            </span>
                          ) : (
                            <span className="text-foreground-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className="tabular-nums">{fmtUsdc(e.totalClaimed)}</span>
                            <Badge
                              variant={pct === 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {pct}%
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground-secondary">
                          {e.holderCount.toString()}
                        </td>
                        <td className="px-4 py-3">
                          {CONTRACT_ADDRESSES.dividendDistributor && (
                            <a
                              href={SNOWSCAN_ADDR(CONTRACT_ADDRESSES.dividendDistributor)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                            >
                              Ver
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function IssuerDividendsPage() {
  const { address } = useWallet();
  const { data: allDividends, isLoading } = useAllDividends();
  const { data: myOfferings } = useOfferings({ mine: true });

  // Filtrar a los dividendos que ESTE issuer declaró (declaredBy == su wallet).
  const myDividends = useMemo(
    () =>
      address
        ? (allDividends ?? []).filter((d) => d.declaredBy.toLowerCase() === address.toLowerCase())
        : (allDividends ?? []),
    [allDividends, address],
  );

  // Index por token y armar bloques por oferta (incluso las que aún no han pagado).
  const blocks = useMemo(() => {
    const eventsByToken = new Map<string, DividendSummary[]>();
    for (const d of myDividends) {
      const k = d.token.toLowerCase();
      const arr = eventsByToken.get(k) ?? [];
      arr.push(d);
      eventsByToken.set(k, arr);
    }
    return (myOfferings ?? [])
      .filter((o) => o.tokenAddress)
      .map((o) => ({
        offering: o,
        events: eventsByToken.get((o.tokenAddress ?? '').toLowerCase()) ?? [],
      }));
  }, [myDividends, myOfferings]);

  // KPIs agregados
  const totalDistributed = myDividends.reduce((acc, d) => acc + d.totalAmount, 0n);
  const totalClaimed = myDividends.reduce((acc, d) => acc + d.totalClaimed, 0n);
  const totalPending = totalDistributed - totalClaimed;
  const globalClaimRate =
    totalDistributed > 0n ? Number((totalClaimed * 100n) / totalDistributed) : 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Emisor', href: '/issuer' }, { label: 'Dividendos' }]}
        title="Distribución de dividendos"
        description="Declara distribuciones de utilidades para los holders de cada oferta. El reparto on-chain es prorrata sobre el cap table en el momento de la declaración."
        meta={
          CONTRACT_ADDRESSES.dividendDistributor ? (
            <a
              href={SNOWSCAN_ADDR(CONTRACT_ADDRESSES.dividendDistributor)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground-tertiary transition-colors hover:text-foreground-secondary"
            >
              Contrato verificado en Snowscan
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null
        }
      />

      {/* KPIs agregados del issuer */}
      <MetricGrid>
        <StatCard
          label="Total distribuido"
          value={`${fmtUsdc(totalDistributed)} USDC`}
          helper={`${myDividends.length} evento${myDividends.length === 1 ? '' : 's'} declarado${
            myDividends.length === 1 ? '' : 's'
          }`}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Ya reclamado"
          value={`${fmtUsdc(totalClaimed)} USDC`}
          helper={`${globalClaimRate}% del total distribuido`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Pasivo pendiente"
          value={`${fmtUsdc(totalPending)} USDC`}
          helper="USDC en pool esperando claim"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Ofertas con pago"
          value={blocks.filter((b) => b.events.length > 0).length.toString()}
          helper={`De ${blocks.length} ofertas tuyas`}
          icon={<Users className="h-4 w-4" />}
        />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Main: por oferta */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : blocks.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-foreground-secondary">
                No tienes ofertas con token deployado. Crea una oferta primero para poder declarar
                dividendos.
              </CardContent>
            </Card>
          ) : (
            blocks.map(({ offering, events }) => (
              <OfferingDividendBlock
                key={offering.id}
                offeringName={offering.name}
                offeringSymbol={offering.symbol}
                tokenAddress={offering.tokenAddress as Address}
                totalSupply={Number(offering.totalSupply)}
                expectedAnnualReturn={offering.expectedAnnualReturn}
                events={events}
              />
            ))
          )}
        </div>

        {/* Sidebar: declare panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DeclareDividendPanel />
        </aside>
      </div>

      {/* Nota metodológica */}
      <p className="mt-6 text-2xs text-foreground-tertiary">
        DPS (dividend per share) = USDC declarado en el evento ÷ supply total del token. El claim
        rate se actualiza on-chain cada vez que un holder llama <code>claim()</code> en el
        DividendDistributor. La fecha "próxima sugerida" es heurística (último evento + 90 días); el
        emisor decide cuándo declarar el siguiente.
      </p>
    </>
  );
}
