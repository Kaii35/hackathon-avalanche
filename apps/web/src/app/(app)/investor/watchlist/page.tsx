'use client';

import { EmptyState, PageHeader, Skeleton } from '@hack/ui';
import { Star } from 'lucide-react';
import { OfferingCard } from '@/components/offerings/OfferingCard';
import { useOfferings } from '@/lib/client/queries/offerings';

const WATCHLIST_IDS = new Set([
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
]);

export default function WatchlistPage() {
  const { data, isLoading } = useOfferings();
  const list = (data ?? []).filter((o) => WATCHLIST_IDS.has(o.id));

  return (
    <>
      <PageHeader
        title="Watchlist"
        description="Ofertas que estás siguiendo. Te avisamos por cambios significativos de precio."
      />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title="Tu watchlist está vacía"
          description="Marca ofertas con la estrella para verlas aquí."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <OfferingCard key={o.id} offering={o} />
          ))}
        </div>
      )}
    </>
  );
}
