'use client';

import Link from 'next/link';
import { Badge, Button, DataTable, Money, PageHeader, Progress, WalletAddress } from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpRight, PlusCircle } from 'lucide-react';
import { useOfferings } from '@/lib/client/queries/offerings';
import type { MockOffering } from '@/lib/client/mocks/offerings';

const columns: ColumnDef<MockOffering>[] = [
  {
    header: 'Oferta',
    accessorKey: 'name',
    cell: ({ row }) => (
      <Link href={`/issuer/offerings/${row.original.id}`} className="group flex items-center gap-2">
        <span className="font-medium text-foreground group-hover:text-brand-400">
          {row.original.name}
        </span>
        <Badge variant="outline" size="sm">
          {row.original.symbol}
        </Badge>
      </Link>
    ),
  },
  {
    header: 'Estado',
    accessorKey: 'status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.status === 'active'
            ? 'success'
            : row.original.status === 'closed'
              ? 'neutral'
              : 'warning'
        }
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    header: 'Token',
    accessorKey: 'tokenAddress',
    cell: ({ row }) =>
      row.original.tokenAddress ? (
        <WalletAddress address={row.original.tokenAddress} size="sm" />
      ) : (
        <span>—</span>
      ),
  },
  {
    header: 'Holders',
    accessorKey: 'holders',
    cell: ({ row }) => (
      <span className="tabular">{row.original.holders.toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: 'Precio',
    accessorKey: 'lastTradePrice',
    cell: ({ row }) => <Money value={row.original.lastTradePrice} currency="USDC" />,
  },
  {
    header: 'Fondeo',
    accessorKey: 'fundedPct',
    cell: ({ row }) => (
      <div className="w-32 space-y-1">
        <div className="flex items-center justify-between text-2xs">
          <span className="tabular text-foreground-secondary">{row.original.fundedPct}%</span>
        </div>
        <Progress value={row.original.fundedPct} />
      </div>
    ),
  },
  {
    header: '',
    id: 'actions',
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" asChild aria-label="Ver oferta">
        <Link href={`/issuer/offerings/${row.original.id}`}>
          <ArrowUpRight />
        </Link>
      </Button>
    ),
  },
];

export default function IssuerOfferingsPage() {
  // `mine: true` makes the API resolve the current user's Issuer server-side
  // and only return offerings for that Issuer. Previously this page filtered
  // client-side by a hardcoded seed issuerId — broken for any real user.
  const { data, isLoading } = useOfferings({ mine: true });
  const mine = data ?? [];

  return (
    <>
      <PageHeader
        title="Mis ofertas"
        description="Gestiona tus emisiones, cap table y operaciones regulatorias."
        actions={
          <Button asChild>
            <Link href="/issuer/offerings/new">
              <PlusCircle className="h-4 w-4" />
              Nueva oferta
            </Link>
          </Button>
        }
      />
      <DataTable columns={columns} data={mine} isLoading={isLoading} />
    </>
  );
}
