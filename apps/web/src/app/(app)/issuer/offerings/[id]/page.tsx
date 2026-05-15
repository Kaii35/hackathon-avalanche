'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
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
import { Activity, Coins, Pause, Settings, Users } from 'lucide-react';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { useOffering } from '@/lib/client/queries/offerings';

export default function IssuerOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);

  if (!offering) return <Skeleton className="h-96 w-full" />;

  const raised =
    (Number(offering.totalSupply) * Number(offering.pricePerUnit) * offering.fundedPct) / 100;

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
        description={offering.description.slice(0, 140) + '…'}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Pausar">
              <Pause />
            </Button>
            <Button variant="secondary">
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
          <TabsTrigger value="captable" asChild>
            <Link href={`/issuer/offerings/${id}/cap-table`}>Cap Table</Link>
          </TabsTrigger>
          <TabsTrigger value="holders" asChild>
            <Link href={`/issuer/offerings/${id}/holders`}>Holders</Link>
          </TabsTrigger>
          <TabsTrigger value="analytics" asChild>
            <Link href={`/issuer/offerings/${id}/analytics`}>Analytics</Link>
          </TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>

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
                      value: <WalletAddress address={offering.tokenAddress ?? '0x'} size="sm" />,
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

        <TabsContent value="documents">
          <Card>
            <CardContent className="space-y-2 pt-6">
              {offering.documents.map((d) => (
                <div
                  key={d.cid}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-elevated p-3"
                >
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="ml-auto text-xs text-foreground-tertiary">{d.size}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
