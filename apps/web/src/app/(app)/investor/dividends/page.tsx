'use client';

import { useEffect, useMemo } from 'react';
import { formatUnits, type Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  MetricGrid,
  Money,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
} from '@hack/ui';
import { Coins, Loader2, CheckCircle2, TrendingUp, CalendarClock, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimableDividends, type ClaimableDividend } from '@/hooks/useDividends';
import { useTokenHolding } from '@/hooks/useTokenHolding';
import { useOfferings } from '@/lib/client/queries/offerings';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { useWallet } from '@/hooks/useWallet';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;
const USDC_DECIMALS = 6;

function fmtUsdc(v: bigint): number {
  return Number(formatUnits(v, USDC_DECIMALS));
}

function fmtDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
  }).format(new Date(Number(unixSeconds) * 1000));
}

function fmtTime(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeStyle: 'short',
  }).format(new Date(Number(unixSeconds) * 1000));
}

/** Botón de reclamo por evento. Pull-claim model: cada dividendo independiente. */
function ClaimButton({ dividend }: { dividend: ClaimableDividend }) {
  const qc = useQueryClient();
  const distributor = CONTRACT_ADDRESSES.dividendDistributor;

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Dividendo reclamado', {
      description: (
        <a
          href={SNOWSCAN_TX(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Ver en Snowscan
        </a>
      ),
    });
    void qc.invalidateQueries({ queryKey: ['dividends'] });
  }, [isMined, txHash, qc]);

  const handleClaim = () => {
    if (!distributor) return;
    writeContract({
      address: distributor as Address,
      abi: ABI.dividendDistributor,
      functionName: 'claim',
      args: [dividend.dividendId],
      chainId: avalancheFuji.id,
    });
  };

  const isPending = isWaitingWallet || isMining;

  if (dividend.claimed) {
    return (
      <Badge variant="success" size="sm">
        <CheckCircle2 className="h-3 w-3" />
        Reclamado
      </Badge>
    );
  }

  return (
    <Button size="sm" onClick={handleClaim} disabled={isPending || !distributor}>
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          {isMining ? 'Confirmando...' : 'Esperando wallet...'}
        </>
      ) : (
        `Reclamar ${fmtUsdc(dividend.amount).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
        })} USDC`
      )}
    </Button>
  );
}

/**
 * Card por oferta — agrupa todos los dividendos de un mismo token y muestra:
 *   - Header con nombre/symbol + métricas de la oferta
 *   - Timeline de eventos con DPS por share (calculado vs balance actual)
 *   - Progress de "lo que ya cobré vs lo asignado"
 *   - Estimación de yield realizado (recibido / costo base aprox)
 */
function OfferingDividendCard({
  tokenAddress,
  events,
  offeringName,
  offeringSymbol,
  pricePerUnit,
  expectedAnnualReturn,
  holderAddress,
}: {
  tokenAddress: Address;
  events: ClaimableDividend[];
  offeringName: string;
  offeringSymbol: string;
  pricePerUnit: number;
  expectedAnnualReturn: number | undefined;
  holderAddress: Address;
}) {
  // Balance actual del holder en este token → necesario para calcular DPS y
  // costo base de manera honesta (lo declaramos así en la UI con tooltip).
  const holding = useTokenHolding(tokenAddress, holderAddress);
  const balanceShares =
    holding.balance !== undefined && holding.decimals !== undefined
      ? Number(holding.balance) / 10 ** holding.decimals
      : 0;

  const totalReceived = events
    .filter((e) => e.claimed)
    .reduce((acc, e) => acc + e.originalAmount, 0n);
  const totalPending = events.filter((e) => !e.claimed).reduce((acc, e) => acc + e.amount, 0n);
  const totalLifetime = events.reduce((acc, e) => acc + e.originalAmount, 0n);

  const claimRate = totalLifetime > 0n ? Number((totalReceived * 100n) / totalLifetime) : 0;

  // Costo base estimado: balance actual × precio nominal. Es una aproximación —
  // si el holder ha transado en mercado secundario el costo real difiere,
  // pero sirve como referencia para el "yield realizado" del dashboard.
  const costBasisUsdc = balanceShares * pricePerUnit;
  const realizedYieldPct =
    costBasisUsdc > 0 ? (fmtUsdc(totalLifetime) / costBasisUsdc) * 100 : null;

  // Próxima fecha estimada: tomamos el último declaredAt y proyectamos +90 días
  // (default trimestral) si tenemos historia, o +6 meses si no.
  const lastDeclared = events[0]?.declaredAt;
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
              Balance: {balanceShares.toLocaleString('es-MX', { maximumFractionDigits: 2 })}{' '}
              {offeringSymbol}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Recibido lifetime
            </p>
            <p className="text-xl font-semibold tabular-nums text-foreground">
              <Money value={fmtUsdc(totalLifetime)} currency="USDC" />
            </p>
            {realizedYieldPct !== null && (
              <p className="text-2xs tabular-nums text-success-fg">
                <TrendingUp className="mr-0.5 inline h-3 w-3" />
                {realizedYieldPct.toFixed(2)}% sobre tu posición
              </p>
            )}
          </div>
        </div>

        {/* Footer del header — claim progress + próxima fecha */}
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Progreso de cobro
            </p>
            <Progress value={claimRate} />
            <p className="text-2xs text-foreground-tertiary tabular-nums">
              {claimRate}% reclamado de tu asignación total
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Pendiente de reclamar
            </p>
            <p className="text-sm font-semibold tabular-nums text-warning-fg">
              {fmtUsdc(totalPending).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
              Próxima fecha estimada
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
                APY esperado: {expectedAnnualReturn.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Timeline de eventos */}
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-elevated/40">
              <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                <th className="px-4 py-2.5 text-right font-medium">Te tocó</th>
                <th className="px-4 py-2.5 text-right font-medium">DPS</th>
                <th className="px-4 py-2.5 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {events.map((e) => {
                // DPS = lo asignado a este holder dividido por su balance actual.
                // Exacto si el holder no transfirió shares entre snapshot y hoy;
                // aproximado si sí lo hizo (limitación on-chain conocida).
                const dps = balanceShares > 0 ? fmtUsdc(e.originalAmount) / balanceShares : 0;
                return (
                  <tr
                    key={e.dividendId.toString()}
                    className="transition-colors hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">{fmtDate(e.declaredAt)}</span>
                        <span className="text-2xs text-foreground-tertiary">
                          {fmtTime(e.declaredAt)} · #{e.dividendId.toString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-foreground">
                        {fmtUsdc(e.originalAmount).toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        USDC
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground-secondary">
                      {dps > 0 ? (
                        <span title="Dividend per share — calculado contra tu balance actual">
                          {dps.toLocaleString('es-MX', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}{' '}
                          USDC / {offeringSymbol}
                        </span>
                      ) : (
                        <span className="text-foreground-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ClaimButton dividend={e} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestorDividendsPage() {
  const { address, realConnected } = useWallet();
  const { data: claimable, isLoading } = useClaimableDividends(address ?? undefined);
  const { data: offerings } = useOfferings();

  // Index offerings by lowercase tokenAddress for fast token → metadata lookup.
  const offeringsByToken = useMemo(() => {
    const m = new Map<
      string,
      {
        name: string;
        symbol: string;
        pricePerUnit: number;
        expectedAnnualReturn: number | undefined;
      }
    >();
    for (const o of offerings ?? []) {
      if (!o.tokenAddress) continue;
      m.set(o.tokenAddress.toLowerCase(), {
        name: o.name,
        symbol: o.symbol,
        pricePerUnit: Number(o.pricePerUnit),
        expectedAnnualReturn: o.expectedAnnualReturn,
      });
    }
    return m;
  }, [offerings]);

  // Agrupar dividendos por token (un card por oferta).
  const grouped = useMemo(() => {
    const m = new Map<string, ClaimableDividend[]>();
    for (const d of claimable ?? []) {
      const key = d.token.toLowerCase();
      const arr = m.get(key) ?? [];
      arr.push(d);
      m.set(key, arr);
    }
    return Array.from(m.entries());
  }, [claimable]);

  // KPIs globales
  const totalReceived = (claimable ?? [])
    .filter((d) => d.claimed)
    .reduce((acc, d) => acc + d.originalAmount, 0n);
  const totalPending = (claimable ?? [])
    .filter((d) => !d.claimed)
    .reduce((acc, d) => acc + d.amount, 0n);
  const totalLifetime = (claimable ?? []).reduce((acc, d) => acc + d.originalAmount, 0n);
  const eventCount = (claimable ?? []).length;

  if (!realConnected) {
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Dividendos' }]}
          title="Mis dividendos"
          description="Visualiza y reclama las utilidades distribuidas por cada oferta donde tienes participación."
        />
        <ConnectWalletPrompt description="Conecta tu wallet para ver tu histórico de dividendos y los pagos pendientes." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Dividendos' }]}
        title="Mis dividendos"
        description="Visualiza y reclama las utilidades distribuidas por cada oferta donde tienes participación."
      />

      {/* KPI cards globales */}
      <MetricGrid>
        <StatCard
          label="Recibido lifetime"
          value={`${fmtUsdc(totalLifetime).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} USDC`}
          helper={`${eventCount} evento${eventCount === 1 ? '' : 's'} en total`}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Por reclamar ahora"
          value={`${fmtUsdc(totalPending).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} USDC`}
          helper={
            totalPending > 0n ? 'Reclama desde cada oferta' : 'Estás al día — sin pagos pendientes'
          }
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Ya cobrado"
          value={`${fmtUsdc(totalReceived).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
          })} USDC`}
          helper={
            totalLifetime > 0n
              ? `${Number((totalReceived * 100n) / totalLifetime)}% de tu asignación total`
              : '—'
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Ofertas que reparten"
          value={grouped.length.toString()}
          helper="Emisores activos en tu portafolio"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </MetricGrid>

      {/* Listado agrupado por oferta */}
      <div className="mt-6 space-y-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={<Coins className="h-6 w-6" />}
                title="No tienes dividendos pendientes"
                description="Los anuncia el emisor cuando hay distribución de utilidades. Apenas se declare uno, aparecerá aquí con el detalle por evento y un botón para reclamar."
              />
            </CardContent>
          </Card>
        ) : (
          grouped.map(([tokenLower, events]) => {
            const tokenAddress = events[0]!.token;
            const offering = offeringsByToken.get(tokenLower);
            return (
              <OfferingDividendCard
                key={tokenLower}
                tokenAddress={tokenAddress}
                events={events}
                offeringName={offering?.name ?? 'Oferta'}
                offeringSymbol={offering?.symbol ?? '—'}
                pricePerUnit={offering?.pricePerUnit ?? 0}
                expectedAnnualReturn={offering?.expectedAnnualReturn}
                holderAddress={address as Address}
              />
            );
          })
        )}
      </div>

      {/* Nota metodológica — transparencia es clave */}
      <p className="mt-6 text-2xs text-foreground-tertiary">
        DPS (dividend per share) y yield realizado se calculan con tu balance actual del token. Si
        compraste o vendiste shares en el mercado secundario entre dos eventos, el DPS por evento es
        exacto solo si no transferiste; el yield es una estimación basada en tu balance actual ×
        precio nominal. El monto USDC en sí es siempre exacto: lo lee el contrato.
      </p>
    </>
  );
}
