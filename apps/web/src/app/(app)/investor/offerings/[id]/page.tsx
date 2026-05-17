'use client';

import Link from 'next/link';
import { use } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
  DataTable,
  KeyValueList,
  Money,
  OrderbookView,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  WalletAddress,
} from '@hack/ui';
import { ArrowUpRight, FileText, Globe2, Star } from 'lucide-react';
import { useOffering, useCapTable } from '@/lib/client/queries/offerings';
import { useOrderbook } from '@/lib/client/queries/orderbook';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { TradingChart } from '@/components/charts/TradingChart';
import { generateDummyCandles, getHistoricalStartPrice } from '@/lib/client/dummyCandles';
import { PlaceOrderPanel } from '@/components/offerings/PlaceOrderPanel';
import type { ColumnDef } from '@tanstack/react-table';
import type { CapTableRowDto } from '@hack/shared';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MOCK_TRADES } from '@/lib/client/mocks/trades';

const ROLE_LABELS: Record<'investor' | 'issuer' | 'admin', string> = {
  investor: 'Inversionista',
  issuer: 'Emisor',
  admin: 'Plataforma',
};

const capColumns: ColumnDef<CapTableRowDto>[] = [
  {
    header: 'Inversionista',
    accessorKey: 'holderName',
    cell: ({ row }) => {
      const { holderName, holderEmail, holderRole, wallet } = row.original;
      if (holderName || holderEmail) {
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {holderName ?? holderEmail ?? '—'}
            </span>
            <div className="flex items-center gap-2">
              {holderRole && (
                <Badge variant="outline" size="sm">
                  {ROLE_LABELS[holderRole]}
                </Badge>
              )}
              <WalletAddress address={wallet} className="text-2xs text-foreground-tertiary" />
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col">
          <span className="text-sm text-foreground-tertiary italic">Wallet externa</span>
          <WalletAddress address={wallet} className="text-2xs text-foreground-tertiary" />
        </div>
      );
    },
  },
  {
    header: 'Balance',
    accessorKey: 'balance',
    cell: ({ row }) => (
      <span className="tabular">{Number(row.original.balance).toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: '%',
    accessorKey: 'percentOfTotal',
    cell: ({ row }) => <span className="tabular">{row.original.percentOfTotal.toFixed(2)}%</span>,
  },
  {
    header: 'Último bloque',
    accessorKey: 'lastUpdatedBlock',
    cell: ({ row }) => (
      <span className="font-mono text-2xs text-foreground-tertiary">
        #{row.original.lastUpdatedBlock}
      </span>
    ),
  },
];

export default function OfferingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering, isLoading } = useOffering(id);
  const { data: orderbook } = useOrderbook(id);
  const { data: capTable } = useCapTable(id);

  if (isLoading || !offering) {
    return (
      <>
        <Skeleton className="mb-6 h-12 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const lastPrice = orderbook?.lastTradePrice
    ? Number(orderbook.lastTradePrice)
    : offering.lastTradePrice;
  const tradesForOffering = MOCK_TRADES.filter((t) => t.offeringId === id).slice(0, 10);

  // OHLC determinístico por offeringId — el modelo es dummy hasta que el
  // indexer agregue trades reales por timeframe (ver SESSION-HANDOFF P0.3).
  // Para tokens con un precio histórico conocido (p.ej. SOLNOR antes del
  // re-pricing) arrancamos el walk ahí para que la curva refleje la caída.
  const startPrice = getHistoricalStartPrice(offering.symbol);
  const candles = generateDummyCandles(id, lastPrice, { startPrice });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Marketplace', href: '/investor/offerings' },
          { label: offering.name },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-lg text-sm font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${offering.thumbnailColor}, ${offering.thumbnailColor}AA)`,
              }}
            >
              {offering.symbol.slice(0, 2)}
            </span>
            {offering.name}
            <Badge variant="outline">{offering.symbol}</Badge>
            <Badge variant={offering.status === 'active' ? 'success' : 'neutral'}>
              {offering.status === 'active' ? 'Activa' : 'Cerrada'}
            </Badge>
          </span>
        }
        description={`${offering.issuerOwnerName ?? offering.issuerName} · Sector ${offering.sector}`}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Watchlist">
              <Star />
            </Button>
            <Button variant="secondary" asChild>
              <Link
                href={`https://testnet.snowtrace.io/address/${offering.tokenAddress}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver contrato
                <ArrowUpRight />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
                    Último precio
                  </p>
                  <p className="text-3xl font-semibold tabular">
                    <Money value={lastPrice} currency="USDC" />
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <Stat
                    label="Volumen 24h"
                    value={`$${offering.volume24h.toLocaleString('es-MX')}`}
                  />
                  <Stat label="Holders" value={offering.holders.toLocaleString('es-MX')} />
                  <Stat label="Fondeo" value={`${offering.fundedPct}%`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2 pt-3">
              <TradingChart data={candles} symbol={offering.symbol} height={340} />
            </CardContent>
          </Card>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orderbook">Libro de órdenes</TabsTrigger>
              <TabsTrigger value="trades">Trades</TabsTrigger>
              <TabsTrigger value="capTable">Cap Table</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Descripción</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-foreground-secondary">
                  <p>{offering.description}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Términos</CardTitle>
                </CardHeader>
                <CardContent>
                  <KeyValueList
                    layout="grid"
                    items={[
                      {
                        label: 'Token',
                        value: <WalletAddress address={offering.tokenAddress ?? '0x'} />,
                      },
                      {
                        label: 'Supply total',
                        value: Number(offering.totalSupply).toLocaleString('es-MX'),
                      },
                      {
                        label: 'Precio unitario',
                        value: <Money value={offering.pricePerUnit} currency="USDC" />,
                      },
                      {
                        label: 'Lockup hasta',
                        value: format(new Date(offering.lockupUntil), 'd MMM yyyy', { locale: es }),
                      },
                      { label: 'Max holders', value: offering.maxHolders.toLocaleString('es-MX') },
                      {
                        label: 'Rendimiento anual esperado',
                        value: (
                          <span className="font-semibold text-success-fg">
                            {(offering.expectedAnnualReturn ?? 0).toFixed(1)}% APY
                          </span>
                        ),
                      },
                      {
                        label: 'Jurisdicciones',
                        value: (
                          <span className="inline-flex items-center gap-1.5">
                            <Globe2 className="h-3.5 w-3.5 text-foreground-tertiary" />
                            {offering.allowedJurisdictions
                              .map((j) =>
                                j === 484 ? 'MX' : j === 840 ? 'US' : j === 724 ? 'ES' : j,
                              )
                              .join(', ')}
                          </span>
                        ),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orderbook">
              {orderbook ? (
                <OrderbookView
                  bids={orderbook.bids.map((b) => ({
                    price: Number(b.price),
                    qty: Number(b.qty),
                    orderCount: b.orderCount,
                  }))}
                  asks={orderbook.asks.map((a) => ({
                    price: Number(a.price),
                    qty: Number(a.qty),
                    orderCount: a.orderCount,
                  }))}
                  lastTradePrice={lastPrice}
                  symbol={offering.symbol}
                />
              ) : (
                <Skeleton className="h-96 w-full" />
              )}
            </TabsContent>

            <TabsContent value="trades">
              <Card>
                <CardContent className="px-0 pb-0 pt-0">
                  <table className="w-full text-sm">
                    <thead className="bg-elevated/40">
                      <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                        <th className="px-4 py-2.5 text-left">Lado</th>
                        <th className="px-4 py-2.5 text-right">Cantidad</th>
                        <th className="px-4 py-2.5 text-right">Precio</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-left">Tx</th>
                        <th className="px-4 py-2.5 text-right">Cuándo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradesForOffering.map((t) => (
                        <tr key={t.id} className="border-b border-border-subtle last:border-0">
                          <td className="px-4 py-2.5">
                            <Badge variant={t.side === 'buy' ? 'success' : 'danger'} size="sm">
                              {t.side === 'buy' ? 'Compra' : 'Venta'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular">
                            {Number(t.qty).toLocaleString('es-MX')}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular">{t.price}</td>
                          <td className="px-4 py-2.5 text-right tabular">
                            {Number(t.total).toLocaleString('es-MX')}
                          </td>
                          <td className="px-4 py-2.5">
                            <a
                              href={`https://testnet.snowtrace.io/tx/${t.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-brand-400 hover:text-brand-300"
                            >
                              {t.txHash.slice(0, 8)}…
                            </a>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-foreground-tertiary tabular">
                            {format(new Date(t.settledAt), 'd MMM HH:mm', { locale: es })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="capTable">
              <DataTable columns={capColumns} data={capTable ?? []} />
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {offering.documents.map((d) => (
                    <a
                      key={d.cid}
                      href={`https://ipfs.io/ipfs/${d.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-elevated p-3 transition-colors hover:border-border-strong"
                    >
                      <FileText className="h-4 w-4 text-foreground-tertiary" />
                      <span className="flex-1 text-sm font-medium text-foreground">{d.name}</span>
                      <span className="text-2xs uppercase text-foreground-tertiary">{d.type}</span>
                      <span className="text-xs text-foreground-tertiary tabular">{d.size}</span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <PlaceOrderPanel
            offeringId={id}
            tokenAddress={offering.tokenAddress as `0x${string}` | undefined}
            symbol={offering.symbol}
            lastPrice={lastPrice}
            balance={12500}
          />

          <ChartCard
            title="Tendencia 7d"
            helper="Precio diario"
            className="mt-6"
            bodyClassName="h-48 px-2"
          >
            <AreaTrend
              data={candles.slice(-7).map((c) => ({
                ts: new Date(c.time).toISOString(),
                value: c.close,
              }))}
              color={offering.thumbnailColor}
            />
          </ChartCard>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">{label}</p>
      <p className="text-base font-semibold tabular">{value}</p>
    </div>
  );
}
