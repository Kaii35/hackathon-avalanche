'use client';

import Link from 'next/link';
import { formatUnits } from 'viem';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Skeleton } from '@hack/ui';
import { ExternalLink } from 'lucide-react';
import { DeclareDividendPanel } from '@/components/dividends/DeclareDividendPanel';
import { useAllDividends } from '@/hooks/useDividends';
import { CONTRACT_ADDRESSES } from '@/lib/client/contracts';

const SNOWSCAN_ADDR = (addr: string) => `https://testnet.snowscan.xyz/address/${addr}`;
const USDC_DECIMALS = 6;

function fmtUsdc(v: bigint): string {
  return Number(formatUnits(v, USDC_DECIMALS)).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(unixSeconds) * 1000));
}

export default function IssuerDividendsPage() {
  const { data: dividends, isLoading } = useAllDividends();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Emisor', href: '/issuer' }, { label: 'Dividendos' }]}
        title="Distribucion de dividendos"
        description="Declara un dividendo para los holders de la oferta ARKDEMO. Los fondos se distribuyen via USDC."
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

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Main: declared dividends history */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dividendos declarados</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <div className="space-y-3 px-6 pb-6">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !dividends || dividends.length === 0 ? (
                <div className="px-6 pb-6 pt-2 text-center text-sm text-foreground-secondary">
                  No hay dividendos declarados todavia. Usa el panel a la derecha para declarar el
                  primero.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-elevated/40">
                      <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                        <th className="px-4 py-2.5 text-left font-medium">ID</th>
                        <th className="px-4 py-2.5 text-right font-medium">Total</th>
                        <th className="px-4 py-2.5 text-right font-medium">Reclamado</th>
                        <th className="px-4 py-2.5 text-right font-medium">Holders</th>
                        <th className="px-4 py-2.5 text-left font-medium">Declarado</th>
                        <th className="px-4 py-2.5 text-left font-medium">Contrato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {dividends.map((d) => {
                        const pct =
                          d.totalAmount > 0n ? Number((d.totalClaimed * 100n) / d.totalAmount) : 0;
                        return (
                          <tr
                            key={d.dividendId.toString()}
                            className="transition-colors hover:bg-elevated/30"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-foreground-secondary">
                              #{d.dividendId.toString()}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {fmtUsdc(d.totalAmount)} USDC
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-2">
                                <span className="tabular-nums">{fmtUsdc(d.totalClaimed)} USDC</span>
                                <Badge
                                  variant={
                                    pct === 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'
                                  }
                                  size="sm"
                                >
                                  {pct}%
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-foreground-secondary">
                              {d.holderCount.toString()}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground-secondary">
                              {fmtDate(d.declaredAt)}
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
        </div>

        {/* Sidebar: declare panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DeclareDividendPanel />
        </aside>
      </div>
    </>
  );
}
