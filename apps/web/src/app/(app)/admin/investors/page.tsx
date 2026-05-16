'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Input,
  KeyValueList,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  WalletAddress,
} from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, ShieldOff, Snowflake } from 'lucide-react';
import { useFreezeWallet, useInvestors } from '@/lib/client/queries/admin';
import type { MockInvestor } from '@/lib/client/mocks/admin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminInvestorsPage() {
  const { data, isLoading } = useInvestors();
  const freeze = useFreezeWallet();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all');

  const [selected, setSelected] = useState<MockInvestor | null>(null);
  const [reason, setReason] = useState('');

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (statusFilter !== 'all') list = list.filter((i) => i.kycStatus === statusFilter);
    if (jurisdictionFilter !== 'all')
      list = list.filter((i) => String(i.jurisdiction) === jurisdictionFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.fullName.toLowerCase().includes(q) ||
          i.email.toLowerCase().includes(q) ||
          (i.wallet?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [data, search, statusFilter, jurisdictionFilter]);

  const columns: ColumnDef<MockInvestor>[] = [
    {
      header: 'Inversionista',
      accessorKey: 'fullName',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.original.fullName}</span>
          <span className="text-2xs text-foreground-tertiary">{row.original.email}</span>
        </div>
      ),
    },
    {
      header: 'Wallet',
      accessorKey: 'wallet',
      cell: ({ row }) =>
        row.original.wallet ? (
          <WalletAddress address={row.original.wallet} size="sm" />
        ) : (
          <span className="text-2xs text-foreground-tertiary">— sin wallet</span>
        ),
    },
    {
      header: 'KYC',
      accessorKey: 'kycStatus',
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.kycStatus === 'verified'
              ? 'success'
              : row.original.kycStatus === 'pending'
                ? 'warning'
                : 'danger'
          }
          size="sm"
        >
          {row.original.kycStatus}
        </Badge>
      ),
    },
    {
      header: 'Jurisdicción',
      accessorKey: 'jurisdictionLabel',
      cell: ({ row }) => (
        <Badge variant="outline" size="sm">
          {row.original.jurisdictionLabel}
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
      header: 'Estado',
      accessorKey: 'frozen',
      cell: ({ row }) =>
        row.original.frozen ? (
          <Badge variant="danger" size="sm">
            <Snowflake className="h-3 w-3" />
            Frozen
          </Badge>
        ) : (
          <Badge variant="success" size="sm">
            Activo
          </Badge>
        ),
    },
    {
      header: 'Invertido',
      accessorKey: 'totalInvested',
      cell: ({ row }) => (
        <span className="tabular">${row.original.totalInvested.toLocaleString('es-MX')}</span>
      ),
    },
  ];

  const onFreezeToggle = async () => {
    if (!selected) return;
    if (!selected.wallet) {
      toast.error('Este inversionista aún no ha vinculado una wallet.');
      return;
    }
    if (reason.length < 5) {
      toast.error('La razón debe tener al menos 5 caracteres.');
      return;
    }
    await freeze.mutateAsync({
      wallet: selected.wallet,
      reason,
      freeze: !selected.frozen,
    });
    toast.success(selected.frozen ? 'Wallet descongelada' : 'Wallet congelada');
    setSelected(null);
    setReason('');
  };

  return (
    <>
      <PageHeader
        title="Inversionistas"
        description="Filtra, audita y aplica operaciones regulatorias por wallet."
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        pageSize={15}
        onRowClick={(row) => setSelected(row)}
        toolbar={
          <>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-tertiary" />
              <Input
                placeholder="Buscar nombre, email o wallet…"
                className="h-8 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos KYC</SelectItem>
                <SelectItem value="verified">Verificados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas jurisdicciones</SelectItem>
                <SelectItem value="484">México</SelectItem>
                <SelectItem value="840">Estados Unidos</SelectItem>
                <SelectItem value="724">España</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.fullName}</SheetTitle>
            <SheetDescription>{selected?.email}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="flex-1 overflow-y-auto p-6">
              <KeyValueList
                items={[
                  {
                    label: 'Wallet',
                    value: selected.wallet ? (
                      <WalletAddress address={selected.wallet} />
                    ) : (
                      <span className="text-foreground-tertiary">— sin vincular</span>
                    ),
                  },
                  { label: 'KYC', value: selected.kycStatus },
                  { label: 'Jurisdicción', value: selected.jurisdictionLabel },
                  { label: 'Calificado', value: selected.accredited ? 'Sí' : 'No' },
                  {
                    label: 'Total invertido',
                    value: `$${selected.totalInvested.toLocaleString('es-MX')}`,
                  },
                  {
                    label: 'Desde',
                    value: format(new Date(selected.joinedAt), 'd MMMM yyyy', { locale: es }),
                  },
                  {
                    label: 'Estado wallet',
                    value: selected.frozen ? (
                      <Badge variant="danger" size="sm">
                        Frozen
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        Activa
                      </Badge>
                    ),
                  },
                ]}
              />

              <div className="mt-6 space-y-2">
                <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Razón regulatoria
                </p>
                <Textarea
                  placeholder="Ej: Orden judicial 12345/2026 — Juzgado 4° Civil"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <SheetFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button
              variant={selected?.frozen ? 'success' : 'destructive'}
              onClick={onFreezeToggle}
              loading={freeze.isPending}
              disabled={!selected?.wallet}
            >
              {selected?.frozen ? (
                <>
                  <ShieldOff className="h-4 w-4" />
                  Descongelar wallet
                </>
              ) : (
                <>
                  <Snowflake className="h-4 w-4" />
                  Congelar wallet
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
