'use client';

import Link from 'next/link';
import { Badge, EmptyState, PageHeader, Skeleton } from '@hack/ui';
import { ListChecks, ExternalLink, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@/hooks/useWallet';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { FujiActivityTable } from '@/components/wallet/FujiActivityTable';
import { useMyOrders, useCancelOrder } from '@/lib/client/queries/orderbook';
import { useOfferings } from '@/lib/client/queries/offerings';

// The /api/orders/mine endpoint includes the most recent settlement TX hash
// on each order. We extend the DTO inline rather than import a type that
// would need to flow through @hack/shared.
type OrderRow = ReturnType<typeof useMyOrders>['data'] extends (infer T)[] | undefined
  ? T & { lastTradeTxHash?: `0x${string}` | null }
  : never;

export default function MyOrdersPage() {
  const { address, realConnected } = useWallet();
  const { data: orders, isLoading } = useMyOrders(address ?? undefined, 'all');
  const { data: offerings } = useOfferings();
  const cancel = useCancelOrder();

  // Lookup rápido offeringId → { name, symbol } para mostrar a qué oferta
  // pertenece cada orden sin hacer N requests extra.
  const offeringsById = new Map(
    (offerings ?? []).map((o) => [o.id, { name: o.name, symbol: o.symbol }]),
  );

  if (!realConnected || !address) {
    return (
      <>
        <PageHeader
          title="Mis órdenes"
          description="Conecta tu wallet para ver las órdenes reales asociadas a tu dirección."
        />
        <ConnectWalletPrompt
          title="Conecta tu wallet para ver tus órdenes"
          description="Las órdenes IFC viven asociadas a una wallet. Conecta una y sólo verás las tuyas."
        />
      </>
    );
  }

  const onCancel = async (orderId: string) => {
    try {
      await cancel.mutateAsync(orderId);
      toast.success('Orden cancelada');
    } catch {
      toast.error('No se pudo cancelar la orden');
    }
  };

  return (
    <>
      <PageHeader
        title="Mis órdenes"
        description="Órdenes EIP-712 firmadas asociadas a tu wallet."
        meta={
          <Badge variant="outline" className="font-mono text-2xs">
            {address.slice(0, 6)}…{address.slice(-4)}
          </Badge>
        }
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Órdenes IFC</h2>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !orders || orders.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="Aún no tienes órdenes firmadas"
            description="Cuando firmes una orden de compra o venta en cualquier oferta, aparecerá aquí con su estado en tiempo real."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-elevated/40">
                <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                  <th className="px-4 py-2.5 text-left">Oferta</th>
                  <th className="px-4 py-2.5 text-left">Lado</th>
                  <th className="px-4 py-2.5 text-right">Cantidad</th>
                  <th className="px-4 py-2.5 text-right">Precio</th>
                  <th className="px-4 py-2.5 text-right">Fill</th>
                  <th className="px-4 py-2.5 text-left">Estado</th>
                  <th className="px-4 py-2.5 text-left">Order hash</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const canCancel = o.status === 'open' || o.status === 'partial';
                  const offering = offeringsById.get(o.offeringId);
                  return (
                    <tr key={o.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2.5">
                        {offering ? (
                          <Link
                            href={`/investor/offerings/${o.offeringId}`}
                            className="group flex items-center gap-2"
                            title={offering.name}
                          >
                            <span className="text-sm font-medium text-foreground group-hover:text-brand-400">
                              {offering.name}
                            </span>
                            <Badge variant="outline" size="sm">
                              {offering.symbol}
                            </Badge>
                          </Link>
                        ) : (
                          <span className="font-mono text-2xs text-foreground-tertiary">
                            {o.offeringId.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={o.side === 'buy' ? 'success' : 'danger'} size="sm">
                          {o.side === 'buy' ? 'Compra' : 'Venta'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {Number(o.qty).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {Number(o.price).toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular text-foreground-secondary">
                        {Number(o.filledQty).toLocaleString('es-MX')} /{' '}
                        {Number(o.qty).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const row = o as OrderRow;
                          const txHash = row.lastTradeTxHash ?? null;
                          if (txHash) {
                            return (
                              <a
                                href={`https://testnet.snowscan.xyz/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-2xs text-brand-400 hover:text-brand-300"
                                title="Ver la TX de settlement en Snowscan"
                              >
                                {txHash.slice(0, 10)}…
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            );
                          }
                          return (
                            <span
                              className="font-mono text-2xs text-foreground-tertiary"
                              title={`Order hash EIP-712 (off-chain). La orden se vuelve rastreable en Snowscan cuando se settlea on-chain.\n\nHash completo: ${o.orderHash}`}
                            >
                              {o.orderHash.slice(0, 10)}…
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canCancel && (
                          <button
                            onClick={() => onCancel(o.id)}
                            disabled={cancel.isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle px-2 py-1 text-2xs text-foreground-secondary transition-colors hover:border-danger-border hover:text-danger-fg disabled:opacity-50"
                          >
                            <XIcon className="h-3 w-3" />
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Actividad on-chain en Fuji
        </h2>
        <FujiActivityTable
          wallet={address}
          title="Tus transacciones reales en Avalanche Fuji"
          helper="Datos en vivo del explorer público."
        />
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'outline'> = {
    open: 'outline',
    partial: 'warning',
    filled: 'success',
    cancelled: 'neutral',
    expired: 'danger',
  };
  const labelMap: Record<string, string> = {
    open: 'Abierta',
    partial: 'Parcial',
    filled: 'Completada',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  };
  return (
    <Badge variant={variantMap[status] ?? 'neutral'} size="sm">
      {labelMap[status] ?? status}
    </Badge>
  );
}
