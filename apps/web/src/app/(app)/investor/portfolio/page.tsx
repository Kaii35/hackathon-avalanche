'use client';

import {
  Badge,
  Button,
  ChartCard,
  DataTable,
  MetricGrid,
  Money,
  PageHeader,
  Percent,
  Sparkline,
  StatCard,
} from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, TrendingUp, Briefcase, Coins } from 'lucide-react';
import Link from 'next/link';
import { AllocationDonut } from '@/components/charts/AllocationDonut';
import { usePortfolio } from '@/lib/client/queries/portfolio';
import { useOfferings } from '@/lib/client/queries/offerings';
import { useWallet } from '@/hooks/useWallet';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';

interface Row {
  offeringId: string;
  offeringName: string;
  symbol: string;
  balance: string;
  pricePerUnit: string;
  marketValue: string;
  delta30: number;
  trend: number[];
  weight: number;
}

const columns: ColumnDef<Row>[] = [
  {
    header: 'Posición',
    accessorKey: 'offeringName',
    cell: ({ row }) => (
      <Link
        href={`/investor/offerings/${row.original.offeringId}`}
        className="group flex items-center gap-2"
      >
        <span className="font-medium text-foreground group-hover:text-brand-400">
          {row.original.offeringName}
        </span>
        <Badge variant="outline" size="sm">
          {row.original.symbol}
        </Badge>
      </Link>
    ),
  },
  {
    header: 'Cantidad',
    accessorKey: 'balance',
    cell: ({ row }) => (
      <span className="tabular">{Number(row.original.balance).toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: 'Precio',
    accessorKey: 'pricePerUnit',
    cell: ({ row }) => <Money value={row.original.pricePerUnit} currency="USDC" />,
  },
  {
    header: 'Valor de mercado',
    accessorKey: 'marketValue',
    cell: ({ row }) => <Money value={row.original.marketValue} currency="MXN" />,
  },
  {
    header: 'Δ 30d',
    accessorKey: 'delta30',
    cell: ({ row }) => <Percent value={row.original.delta30} signed colored />,
  },
  {
    header: 'Tendencia',
    cell: ({ row }) => <Sparkline data={row.original.trend} width={80} height={24} />,
  },
  {
    header: '% del portafolio',
    accessorKey: 'weight',
    cell: ({ row }) => <Percent value={row.original.weight} />,
  },
];

export default function PortfolioPage() {
  const { address, realConnected } = useWallet();
  const wallet = address ?? undefined;
  const { data: portfolio, isLoading } = usePortfolio(wallet);
  const { data: offerings } = useOfferings();

  if (!realConnected || !wallet) {
    return (
      <>
        <PageHeader
          title="Portafolio"
          description="Conecta tu wallet para ver tus participaciones reales en Avalanche Fuji."
        />
        <ConnectWalletPrompt
          title="Conecta tu wallet para ver tu portafolio"
          description="Tus posiciones se calculan en tiempo real leyendo los smart contracts ERC-3643."
        />
      </>
    );
  }

  const total = Number(portfolio?.totalMarketValue ?? 0);
  const positions = portfolio?.positions ?? [];
  const offeringsById = new Map((offerings ?? []).map((o) => [o.id, o]));

  const rows: Row[] = positions.map((p) => {
    const off = offeringsById.get(p.offeringId);
    const trend = off?.trend7d ?? [100, 100];
    const delta30 = trend.length > 1 ? ((trend.at(-1)! - trend[0]!) / trend[0]!) * 100 : 0;
    return {
      offeringId: p.offeringId,
      offeringName: p.offeringName,
      symbol: p.symbol,
      balance: p.balance,
      pricePerUnit: p.pricePerUnit,
      marketValue: p.marketValue,
      delta30,
      trend,
      weight: total > 0 ? (Number(p.marketValue) / total) * 100 : 0,
    };
  });

  const allocation = rows.map((r) => ({ label: r.symbol, value: Number(r.marketValue) }));

  // PnL real: hoy no llevamos cost basis por holder. Mientras se cablea el
  // indexer + un servicio de trade history per-holder, evitamos mostrar
  // números inventados que confundirían al cliente.
  const hasPositions = positions.length > 0;

  return (
    <>
      <PageHeader
        title="Portafolio"
        description="Tus participaciones tokenizadas y desempeño consolidado."
        actions={
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      <MetricGrid>
        <StatCard
          label="Valor de mercado"
          value={
            isLoading ? '—' : `$${total.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
          }
          helper="USDC, leído on-chain"
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Posiciones"
          value={positions.length}
          helper={hasPositions ? 'En tu wallet' : 'Sin posiciones todavía'}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="PnL realizado"
          value={hasPositions ? '—' : '$0'}
          helper={hasPositions ? 'Pendiente: historial de cost basis' : 'Sin movimientos'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="PnL no realizado"
          value={hasPositions ? '—' : '$0'}
          helper={hasPositions ? 'Pendiente: historial de cost basis' : 'Sin movimientos'}
        />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Allocation" helper="Distribución por oferta" className="lg:col-span-1">
          <AllocationDonut data={allocation} />
        </ChartCard>
        <div className="lg:col-span-2">
          <DataTable columns={columns} data={rows} />
        </div>
      </div>
    </>
  );
}
