'use client';

import { use } from 'react';
import { ChartCard, DataTable, PageHeader, Skeleton, WalletAddress } from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { CapTableRowDto } from '@hack/shared';
import { useCapTable, useOffering } from '@/lib/client/queries/offerings';
import { AllocationDonut } from '@/components/charts/AllocationDonut';

const columns: ColumnDef<CapTableRowDto>[] = [
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

export default function CapTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);
  const { data: capTable, isLoading } = useCapTable(id);

  if (!offering) return <Skeleton className="h-screen w-full" />;

  const rows = capTable ?? [];
  const allocation = rows.slice(0, 8).map((r) => ({
    label: `${r.wallet.slice(0, 8)}…`,
    value: Number(r.balance) * Number(offering.pricePerUnit),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Mis ofertas', href: '/issuer/offerings' },
          { label: offering.name, href: `/issuer/offerings/${id}` },
          { label: 'Cap Table' },
        ]}
        title={`Cap Table · ${offering.symbol}`}
        description="Distribución completa on-chain. Sincronizada con el indexer."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Top 8 holders"
          helper="Distribución por valor de mercado"
          className="lg:col-span-1"
        >
          <AllocationDonut data={allocation} />
        </ChartCard>
        <div className="lg:col-span-2">
          <DataTable columns={columns} data={rows} isLoading={isLoading} pageSize={20} />
        </div>
      </div>
    </>
  );
}
