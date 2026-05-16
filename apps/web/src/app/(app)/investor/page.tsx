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
  Wallet as WalletIcon,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { OfferingCard } from '@/components/offerings/OfferingCard';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { OnChainStatusCard } from '@/components/dashboard/OnChainStatusCard';
import { DividendsClaimableBanner } from '@/components/dividends/DividendsClaimableBanner';
import { useOfferings } from '@/lib/client/queries/offerings';
import { usePortfolio, usePortfolioHistory } from '@/lib/client/queries/portfolio';
import { useWallet } from '@/hooks/useWallet';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useSession } from '@/lib/client/queries/session';

function fmtAvax(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function fmtUsdc(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

export default function InvestorDashboard() {
  const { address, realConnected } = useWallet();
  const { data: session } = useSession();
  const balances = useWalletBalances();
  const walletAddress = address ?? undefined;
  const { data: portfolio } = usePortfolio(walletAddress);
  const { data: history } = usePortfolioHistory(walletAddress);
  const { data: offerings } = useOfferings({ status: 'active' });

  const totalValue = Number(portfolio?.totalMarketValue ?? 0);
  const previousValue =
    history && history.length > 30
      ? (history[history.length - 31]?.value ?? totalValue)
      : totalValue;
  const delta30 = previousValue ? ((totalValue - previousValue) / previousValue) * 100 : 0;
  const recommended = (offerings ?? []).slice(0, 3);

  const firstName = session?.firstName ?? null;
  const displayFirst = firstName ?? session?.displayName?.split(' ')[0] ?? null;
  const greeting = displayFirst ? `Hola, ${displayFirst} 👋` : 'Hola 👋';
  const needsProfile = session && !session.firstName;

  return (
    <>
      <PageHeader
        title={<>{greeting}</>}
        description={
          realConnected
            ? 'Vista rápida de tu portafolio y oportunidades para hoy.'
            : 'Conecta tu wallet para ver tus balances y posiciones reales.'
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {session?.kycStatus === 'verified' ? (
              <Badge variant="success">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success" />
                KYC verificado
              </Badge>
            ) : session?.kycStatus === 'pending' ? (
              <Badge variant="warning">KYC en revisión</Badge>
            ) : (
              <Badge variant="outline">KYC pendiente</Badge>
            )}
            {realConnected && address ? (
              <WalletAddress
                address={address}
                className="rounded-md border border-border-subtle bg-surface px-2 py-1"
              />
            ) : (
              <Badge variant="outline">
                <WalletIcon className="mr-1 h-3 w-3" />
                Wallet no conectada
              </Badge>
            )}
            {realConnected && !balances.isCorrectChain && (
              <Badge variant="warning">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Cambia a Avalanche Fuji
              </Badge>
            )}
          </div>
        }
        actions={
          <Button asChild>
            <Link href="/investor/offerings">
              Explorar mercado
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {needsProfile && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-info-border bg-info-bg/40 px-4 py-3 text-sm text-info-fg">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Completa tu perfil</p>
            <p className="text-xs text-info-fg/80">
              Tu cuenta no tiene nombre registrado. Agrégalo para que tu información aparezca
              correctamente en la plataforma y en el KYC.
            </p>
          </div>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/investor/profile">Completar perfil</Link>
          </Button>
        </div>
      )}

      {!realConnected ? (
        <ConnectWalletPrompt
          size="lg"
          description={
            <>
              Tus balances de AVAX y USDC, tus posiciones IFC y tu historial sólo se muestran
              después de conectar una wallet.{' '}
              <strong>No usamos datos de demostración una vez logueado.</strong>
            </>
          }
        />
      ) : (
        <>
          {address && <DividendsClaimableBanner wallet={address} />}

          {address && (
            <div className="mb-4">
              <OnChainStatusCard address={address} />
            </div>
          )}

          <MetricGrid>
            <StatCard
              label="AVAX en wallet"
              value={
                balances.avax.isLoading
                  ? '—'
                  : `${fmtAvax(balances.avax.formatted)} ${balances.avax.symbol}`
              }
              helper={balances.isCorrectChain ? 'Avalanche Fuji · on-chain' : 'Red incorrecta'}
              icon={<WalletIcon className="h-4 w-4" />}
            />
            <StatCard
              label="USDC en wallet"
              value={
                balances.usdc.isLoading
                  ? '—'
                  : `$${fmtUsdc(balances.usdc.formatted)} ${balances.usdc.symbol}`
              }
              helper={balances.isCorrectChain ? 'Circle USDC en Fuji' : 'Red incorrecta'}
              icon={<Coins className="h-4 w-4" />}
            />
            <StatCard
              label="Posiciones IFC (demo)"
              value={portfolio?.positions.length ?? 0}
              helper="Derivado de tu dirección"
              icon={<Briefcase className="h-4 w-4" />}
            />
            <StatCard
              label="Próximo vencimiento"
              value="Sep 2026"
              helper="Crédito PYME Series A · lockup"
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </MetricGrid>

          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg/40 px-3 py-2 text-xs text-warning-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              AVAX y USDC son <strong>balances reales</strong> leídos directo de tu wallet en Fuji.
              Las posiciones IFC son <strong>simuladas</strong> hasta que los smart contracts
              ERC-3643 se deployen — son únicas por wallet pero no representan tokens on-chain.
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <ChartCard
              title="Valor del portafolio (demo)"
              helper="90 días simulados · derivado de tu wallet · MXN equivalente"
              className="lg:col-span-2"
            >
              {history ? (
                <AreaTrend
                  data={history.map((p) => ({ ts: p.ts, value: p.value }))}
                  yLabel="Valor"
                />
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumen wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary">Wallet</span>
                  {address && <WalletAddress address={address} size="sm" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary">Red</span>
                  <Badge variant={balances.isCorrectChain ? 'success' : 'warning'}>
                    {balances.isCorrectChain ? 'Avalanche Fuji' : 'Otra red'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary">AVAX</span>
                  <span className="font-mono tabular-nums">{fmtAvax(balances.avax.formatted)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-tertiary">USDC</span>
                  <span className="font-mono tabular-nums">
                    ${fmtUsdc(balances.usdc.formatted)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <span className="text-foreground-tertiary">Cambio 30d (demo)</span>
                  <Badge variant={delta30 >= 0 ? 'success' : 'danger'}>
                    {delta30 >= 0 ? '+' : ''}
                    {delta30.toFixed(2)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {portfolio && portfolio.positions.length > 0 && (
            <section className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Tu portafolio IFC (demo, derivado de {address?.slice(0, 6)}…{address?.slice(-4)}
                    )
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <table className="w-full text-sm">
                    <thead className="text-2xs uppercase tracking-wider text-foreground-tertiary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-2 text-left font-medium">Oferta</th>
                        <th className="px-4 py-2 text-right font-medium">Cantidad</th>
                        <th className="px-4 py-2 text-right font-medium">Precio</th>
                        <th className="px-4 py-2 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {portfolio.positions.map((p) => (
                        <tr key={p.offeringId}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-foreground">{p.offeringName}</div>
                            <div className="text-2xs text-foreground-tertiary">{p.symbol}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {Number(p.balance).toLocaleString('es-MX')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-foreground-secondary">
                            ${Number(p.pricePerUnit).toLocaleString('es-MX')}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            $
                            {Number(p.marketValue).toLocaleString('es-MX', {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border bg-elevated/40">
                        <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          ${totalValue.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Ofertas activas</h2>
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
