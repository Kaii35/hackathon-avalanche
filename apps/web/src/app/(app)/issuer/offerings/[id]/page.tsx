'use client';

import { use, useState } from 'react';
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
  MetricGrid,
  Money,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  WalletAddress,
} from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Activity, Coins, ExternalLink, FileText, Pause, Settings, Users } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import type { CapTableRowDto } from '@hack/shared';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { useCapTable, useOffering } from '@/lib/client/queries/offerings';
import { EditOfferingSheet } from '@/components/issuer/EditOfferingSheet';

const capTableColumns: ColumnDef<CapTableRowDto>[] = [
  {
    header: 'Wallet',
    accessorKey: 'wallet',
    cell: ({ row }) => <WalletAddress address={row.original.wallet} />,
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
    header: 'Bloque',
    accessorKey: 'lastUpdatedBlock',
    cell: ({ row }) => (
      <span className="font-mono text-2xs text-foreground-tertiary">
        #{row.original.lastUpdatedBlock}
      </span>
    ),
  },
];

interface HolderRow {
  wallet: `0x${string}`;
  balance: string;
  jurisdiction: string;
  accredited: boolean;
  joinedAt: string;
}

const holderColumns: ColumnDef<HolderRow>[] = [
  {
    header: 'Wallet',
    accessorKey: 'wallet',
    cell: ({ row }) => <WalletAddress address={row.original.wallet} />,
  },
  {
    header: 'Balance',
    accessorKey: 'balance',
    cell: ({ row }) => (
      <span className="tabular">{Number(row.original.balance).toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: 'Jurisdicción',
    accessorKey: 'jurisdiction',
    cell: ({ row }) => (
      <Badge variant="outline" size="sm">
        {row.original.jurisdiction}
      </Badge>
    ),
  },
  {
    header: 'Calificado',
    accessorKey: 'accredited',
    cell: ({ row }) => (
      <Badge variant={row.original.accredited ? 'success' : 'neutral'} size="sm">
        {row.original.accredited ? 'Sí' : 'No'}
      </Badge>
    ),
  },
  {
    header: 'Desde',
    accessorKey: 'joinedAt',
    cell: ({ row }) => (
      <span className="text-xs text-foreground-tertiary tabular">
        {new Date(row.original.joinedAt).toLocaleDateString('es-MX')}
      </span>
    ),
  },
];

export default function IssuerOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);
  const { data: capTable, isLoading: capTableLoading } = useCapTable(id);
  const [editOpen, setEditOpen] = useState(false);

  if (!offering) return <Skeleton className="h-96 w-full" />;

  const raised =
    (Number(offering.totalSupply) * Number(offering.pricePerUnit) * offering.fundedPct) / 100;
  const capRows = capTable ?? [];
  const allocation = capRows.slice(0, 8).map((r) => ({
    label: `${r.wallet.slice(0, 8)}…`,
    value: Number(r.balance) * Number(offering.pricePerUnit),
  }));
  const holderRows: HolderRow[] = capRows.map((c, i) => ({
    wallet: c.wallet,
    balance: c.balance,
    jurisdiction: i % 6 === 0 ? 'US' : i % 9 === 0 ? 'ES' : 'MX',
    accredited: i % 3 !== 0,
    joinedAt: new Date(Date.now() - i * 86400_000 * 4).toISOString(),
  }));

  // Analytics — placeholder until indexer feeds real trade volumes
  const fundingHistory = Array.from({ length: 60 }).map((_, i) => ({
    ts: new Date(Date.now() - (59 - i) * 86400000).toISOString(),
    value: i * 32_000 + 280_000 + Math.sin(i / 4) * 18_000,
  }));
  const volumeBars = Array.from({ length: 14 }).map((_, i) => ({
    day: `D${i + 1}`,
    volume: 80_000 + Math.random() * 320_000 + i * 6_000,
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Mis ofertas', href: '/issuer/offerings' },
          { label: offering.name },
        ]}
        title={
          <span className="flex items-center gap-3">
            {offering.name}
            <Badge variant="outline">{offering.symbol}</Badge>
            <Badge variant={offering.status === 'active' ? 'success' : 'neutral'}>
              {offering.status}
            </Badge>
          </span>
        }
        description={
          offering.description.slice(0, 140) + (offering.description.length > 140 ? '…' : '')
        }
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Pausar">
              <Pause />
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Settings className="h-4 w-4" />
              Editar
            </Button>
          </>
        }
      />

      <MetricGrid>
        <StatCard
          label="Capital fondeado"
          value={`$${raised.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
          helper="USDC equivalente"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Holders"
          value={offering.holders.toLocaleString('es-MX')}
          helper={`Max ${offering.maxHolders.toLocaleString('es-MX')}`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard label="Fondeo" value={`${offering.fundedPct}%`} helper="del supply total" />
        <StatCard
          label="Volumen 24h"
          value={`$${offering.volume24h.toLocaleString('es-MX')}`}
          icon={<Activity className="h-4 w-4" />}
        />
      </MetricGrid>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="captable">Cap Table</TabsTrigger>
          <TabsTrigger value="holders">Holders</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard title="Precio · 30 días" helper="USDC" className="lg:col-span-2">
              <AreaTrend
                data={offering.pricingHistory.map((p) => ({ ts: p.ts, value: p.price }))}
                color={offering.thumbnailColor}
                yLabel="Precio"
              />
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle>Fondeo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={offering.fundedPct} />
                <p className="text-2xs text-foreground-tertiary">
                  {offering.fundedPct}% de {Number(offering.totalSupply).toLocaleString('es-MX')}{' '}
                  unidades
                </p>
                <KeyValueList
                  items={[
                    {
                      label: 'Token',
                      value: offering.tokenAddress ? (
                        <WalletAddress address={offering.tokenAddress} size="sm" />
                      ) : (
                        <span className="text-foreground-tertiary">— sin deploy</span>
                      ),
                    },
                    {
                      label: 'Precio',
                      value: <Money value={offering.pricePerUnit} currency="USDC" />,
                    },
                    {
                      label: 'Lockup',
                      value: new Date(offering.lockupUntil).toLocaleDateString('es-MX'),
                    },
                    { label: 'Max holders', value: offering.maxHolders.toLocaleString('es-MX') },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CAP TABLE */}
        <TabsContent value="captable">
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard
              title="Top 8 holders"
              helper="Distribución por valor de mercado"
              className="lg:col-span-1"
            >
              <AllocationDonut data={allocation} />
            </ChartCard>
            <div className="lg:col-span-2">
              <DataTable
                columns={capTableColumns}
                data={capRows}
                isLoading={capTableLoading}
                pageSize={20}
              />
            </div>
          </div>
        </TabsContent>

        {/* HOLDERS */}
        <TabsContent value="holders">
          <DataTable
            columns={holderColumns}
            data={holderRows}
            isLoading={capTableLoading}
            pageSize={15}
          />
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics">
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
                  <RTooltip
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
                  <Bar dataKey="volume" fill="#2A5BFF" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documentos de la oferta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {offering.prospectusIpfs ? (
                <DocumentRow
                  name="Prospecto"
                  reference={offering.prospectusIpfs}
                  hint="Documento principal de la oferta"
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-border-subtle bg-elevated/40 p-4 text-sm text-foreground-tertiary">
                  <div className="flex items-center gap-3">
                    <FileText className="size-4" />
                    <span>Aún no has subido el prospecto.</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    Editar oferta
                  </Button>
                </div>
              )}
              {/* Mock-rendered helper docs from the offering mock shape, if any */}
              {offering.documents?.map((d) => (
                <DocumentRow key={d.cid} name={d.name} reference={d.cid} hint={d.size} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditOfferingSheet offering={offering} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function DocumentRow({
  name,
  reference,
  hint,
}: {
  name: string;
  reference: string;
  hint?: string;
}) {
  const looksLikeUrl = reference.startsWith('http');
  const href = looksLikeUrl
    ? reference
    : reference.startsWith('bafy') || reference.startsWith('Qm')
      ? `https://ipfs.io/ipfs/${reference}`
      : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-elevated p-3">
      <FileText className="size-4 text-foreground-secondary" />
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-medium">{name}</span>
        <span className="truncate text-2xs text-foreground-tertiary">{reference}</span>
      </div>
      {hint && <span className="text-xs text-foreground-tertiary">{hint}</span>}
      {href && (
        <Button variant="ghost" size="icon-sm" asChild aria-label="Abrir documento">
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>
      )}
    </div>
  );
}
