'use client';

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hack/ui';
import { ListChecks, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { OrderResponseDto } from '@hack/shared';
import { useMyOrders, useCancelOrder } from '@/lib/client/queries/orderbook';
import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

function makeColumns(onCancel: (id: string) => void): ColumnDef<OrderResponseDto>[] {
  return [
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
        <span className="tabular">
          {Number(row.original.qty).toLocaleString('es-MX')}
          <span className="ml-1 text-2xs text-foreground-tertiary">
            ({Number(row.original.filledQty).toLocaleString('es-MX')} llenado)
          </span>
        </span>
      ),
    },
    {
      header: 'Precio',
      accessorKey: 'price',
      cell: ({ row }) => <span className="tabular">{row.original.price}</span>,
    },
    {
      header: 'Total',
      cell: ({ row }) => (
        <span className="tabular">
          {(Number(row.original.qty) * Number(row.original.price)).toLocaleString('es-MX', {
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'status',
      cell: ({ row }) => {
        const s = row.original.status;
        const variant =
          s === 'open' || s === 'partial'
            ? 'info'
            : s === 'filled'
              ? 'success'
              : s === 'cancelled'
                ? 'neutral'
                : 'warning';
        return (
          <Badge variant={variant as 'info' | 'success' | 'neutral' | 'warning'} size="sm">
            {s}
          </Badge>
        );
      },
    },
    {
      header: 'Vence',
      accessorKey: 'expiresAt',
      cell: ({ row }) => (
        <span className="text-xs text-foreground-tertiary tabular">
          {format(new Date(row.original.expiresAt), 'd MMM HH:mm', { locale: es })}
        </span>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'open' || row.original.status === 'partial' ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onCancel(row.original.id)}
            aria-label="Cancelar orden"
          >
            <X />
          </Button>
        ) : null,
    },
  ];
}

export default function MyOrdersPage() {
  const [tab, setTab] = useState<'open' | 'filled' | 'all'>('open');
  const { data: orders, isLoading } = useMyOrders(tab);
  const cancel = useCancelOrder();

  const onCancel = async (id: string) => {
    await cancel.mutateAsync(id);
    toast.success('Orden cancelada');
  };

  const columns = makeColumns(onCancel);
  const filtered = orders ?? [];

  return (
    <>
      <PageHeader
        title="Mis órdenes"
        description="Tus órdenes activas, parciales, llenadas y canceladas."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'filled' | 'all')}>
        <TabsList>
          <TabsTrigger value="open">Activas</TabsTrigger>
          <TabsTrigger value="filled">Filleadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {filtered.length === 0 && !isLoading ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" />}
              title="No hay órdenes en este filtro"
              description="Cuando crees una orden firmada aparecerá aquí."
            />
          ) : (
            <DataTable columns={columns} data={filtered} isLoading={isLoading} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
