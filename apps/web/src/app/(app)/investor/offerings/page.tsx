'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@hack/ui';
import { Filter, Search, Store } from 'lucide-react';
import { OfferingCard } from '@/components/offerings/OfferingCard';
import { useOfferings } from '@/lib/client/queries/offerings';

const SECTORS = [
  'Todos',
  'Crédito Productivo',
  'Bienes Raíces',
  'Energía / Agro',
  'Venture Capital',
  'Infraestructura',
];
const STATUSES = ['Todas', 'active', 'closed'] as const;

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('Todos');
  const [status, setStatus] = useState<string>('Todas');
  const [jurisdiction, setJurisdiction] = useState<string>('all');

  const { data, isLoading } = useOfferings();

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.symbol.toLowerCase().includes(q) ||
          o.issuerName.toLowerCase().includes(q),
      );
    }
    if (sector !== 'Todos') list = list.filter((o) => o.sector === sector);
    if (status !== 'Todas') list = list.filter((o) => o.status === status);
    if (jurisdiction !== 'all')
      list = list.filter((o) => o.allowedJurisdictions.includes(Number(jurisdiction)));
    return list;
  }, [data, search, sector, status, jurisdiction]);

  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Explora ofertas activas. Filtra por jurisdicción, sector o liquidez."
        meta={
          <Badge variant="outline">
            {(data ?? []).length} ofertas totales ·{' '}
            {(data ?? []).filter((o) => o.status === 'active').length} activas
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <Card className="sticky top-20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">
                <Filter className="mr-1.5 inline h-3.5 w-3.5 text-foreground-tertiary" />
                Filtros
              </CardTitle>
              <Button
                variant="link"
                size="xs"
                onClick={() => {
                  setSearch('');
                  setSector('Todos');
                  setStatus('Todas');
                  setJurisdiction('all');
                }}
              >
                Limpiar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-tertiary" />
                  <Input
                    placeholder="Nombre, símbolo, IFC…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Sector
                </label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Estado
                </label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === 'active' ? 'Activas' : s === 'closed' ? 'Cerradas' : 'Todas'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Jurisdicción
                </label>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="484">México</SelectItem>
                    <SelectItem value="840">Estados Unidos</SelectItem>
                    <SelectItem value="724">España</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border border-border-subtle bg-elevated p-3 text-xs text-foreground-secondary">
                Solo verás ofertas elegibles para tu jurisdicción y nivel de KYC.
              </div>
            </CardContent>
          </Card>
        </aside>

        <section>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Store className="h-5 w-5" />}
              title="Sin ofertas con esos filtros"
              description="Ajusta tus criterios o limpia los filtros para ver todo el marketplace."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((o) => (
                <OfferingCard key={o.id} offering={o} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
