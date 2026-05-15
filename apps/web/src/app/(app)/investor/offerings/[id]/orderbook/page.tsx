'use client';

import { use } from 'react';
import { OrderbookView, PageHeader, Skeleton } from '@hack/ui';
import { useOffering } from '@/lib/client/queries/offerings';
import { useOrderbook } from '@/lib/client/queries/orderbook';
import Link from 'next/link';

export default function OrderbookExpandedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: offering } = useOffering(id);
  const { data: orderbook } = useOrderbook(id);

  if (!offering) return <Skeleton className="h-screen w-full" />;

  const lastPrice = orderbook?.lastTradePrice
    ? Number(orderbook.lastTradePrice)
    : offering.lastTradePrice;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Marketplace', href: '/investor/offerings' },
          { label: offering.name, href: `/investor/offerings/${id}` },
          { label: 'Libro de órdenes' },
        ]}
        title={`Libro de órdenes · ${offering.symbol}`}
        description="Vista expandida con profundidad completa actualizada en tiempo real."
      />
      {orderbook ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <OrderbookView
            bids={orderbook.bids.map((b) => ({
              price: Number(b.price),
              qty: Number(b.qty),
              orderCount: b.orderCount,
            }))}
            asks={orderbook.asks.map((a) => ({
              price: Number(a.price),
              qty: Number(a.qty),
              orderCount: a.orderCount,
            }))}
            lastTradePrice={lastPrice}
            symbol={offering.symbol}
            rows={20}
          />
          <div className="flex items-start justify-center">
            <Link
              href={`/investor/offerings/${id}`}
              className="text-sm text-brand-400 hover:text-brand-300"
            >
              ← Volver al detalle
            </Link>
          </div>
        </div>
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </>
  );
}
