'use client';

import { useState, useMemo } from 'react';
import {
  Badge,
  DataTable,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  WalletAddress,
} from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useMyTrades } from '@/lib/client/queries/portfolio';
import type { MockTrade } from '@/lib/client/mocks/trades';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const columns: ColumnDef<MockTrade>[] = [
  {
    header: 'Oferta',
    accessorKey: 'offeringName',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.original.offeringName}</span>
        <Badge variant="outline" size="sm">
          {row.original.symbol}
        </Badge>
      </div>
    ),
  },
  {
    header: 'Lado',
    accessorKey: 'side',
    cell: ({ row }) => (
      <Badge variant={row.original.side === 'buy' ? 'success' : 'danger'} size="sm">
        {row.original.side === 'buy' ? 'Compra' : 'Venta'}
      </Badge>
    ),
  },
  {
    header: 'Cantidad',
    accessorKey: 'qty',
    cell: ({ row }) => (
      <span className="tabular">{Number(row.original.qty).toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: 'Precio',
    accessorKey: 'price',
    cell: ({ row }) => <span className="tabular">{row.original.price}</span>,
  },
  {
    header: 'Total',
    accessorKey: 'total',
    cell: ({ row }) => (
      <span className="tabular">
        {Number(row.original.total).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    header: 'Contraparte',
    accessorKey: 'counterparty',
    cell: ({ row }) => <WalletAddress address={row.original.counterparty} size="sm" />,
  },
  {
    header: 'Tx',
    accessorKey: 'txHash',
    cell: ({ row }) => (
      <a
        href={`https://testnet.snowtrace.io/tx/${row.original.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-brand-400 hover:text-brand-300"
      >
        {row.original.txHash.slice(0, 10)}…
      </a>
    ),
  },
  {
    header: 'Cuándo',
    accessorKey: 'settledAt',
    cell: ({ row }) => (
      <span className="text-xs text-foreground-tertiary tabular">
        {format(new Date(row.original.settledAt), 'd MMM yyyy HH:mm', { locale: es })}
      </span>
    ),
  },
];

export default function TradesPage() {
  const { data, isLoading } = useMyTrades();
  const [search, setSearch] = useState('');
  const [symbol, setSymbol] = useState('all');

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (symbol !== 'all') list = list.filter((t) => t.symbol === symbol);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.offeringName.toLowerCase().includes(q) || t.txHash.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search, symbol]);

  const symbols = Array.from(new Set((data ?? []).map((t) => t.symbol)));

  return (
    <>
      <PageHeader title="Mis trades" description="Historial completo de operaciones liquidadas." />
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        toolbar={
          <>
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-tertiary" />
              <Input
                placeholder="Buscar oferta o tx…"
                className="h-8 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los símbolos</SelectItem>
                {symbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  );
}
