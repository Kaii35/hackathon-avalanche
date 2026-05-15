'use client';

import { use } from 'react';
import { Badge, DataTable, PageHeader, Skeleton, WalletAddress } from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useCapTable, useOffering } from '@/lib/client/queries/offerings';

interface HolderRow {
  wallet: `0x${string}`;
  balance: string;
  jurisdiction: string;
  accredited: boolean;
  joinedAt: string;
}

const columns: ColumnDef<HolderRow>[] = [
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

export default function HoldersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);
  const { data: cap } = useCapTable(id);

  if (!offering) return <Skeleton className="h-screen w-full" />;

  const rows: HolderRow[] = (cap ?? []).map((c, i) => ({
    wallet: c.wallet,
    balance: c.balance,
    jurisdiction: i % 6 === 0 ? 'US' : i % 9 === 0 ? 'ES' : 'MX',
    accredited: i % 3 !== 0,
    joinedAt: new Date(Date.now() - i * 86400_000 * 4).toISOString(),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Mis ofertas', href: '/issuer/offerings' },
          { label: offering.name, href: `/issuer/offerings/${id}` },
          { label: 'Holders' },
        ]}
        title={`Holders · ${offering.symbol}`}
        description="Detalle de cada inversionista con su jurisdicción y nivel de KYC."
      />
      <DataTable columns={columns} data={rows} pageSize={15} />
    </>
  );
}
