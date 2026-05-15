'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  Money,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hack/ui';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useCreateOrder } from '@/lib/client/queries/orderbook';
import { toast } from 'sonner';

export function PlaceOrderPanel({
  offeringId,
  symbol,
  lastPrice,
  balance = 0,
}: {
  offeringId: string;
  symbol: string;
  lastPrice: number;
  balance?: number;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('100');
  const [price, setPrice] = useState(lastPrice.toFixed(2));
  const create = useCreateOrder();

  const total = useMemo(() => Number(qty || '0') * Number(price || '0'), [qty, price]);
  const fee = total * 0.005;

  const insufficient = side === 'sell' && Number(qty) > balance;

  const submit = async () => {
    if (!qty || !price) return;
    try {
      await create.mutateAsync({ offeringId, side, qty, price });
      toast.success(`Orden ${side === 'buy' ? 'de compra' : 'de venta'} firmada`, {
        description: `${qty} ${symbol} @ ${price} USDC`,
      });
    } catch {
      toast.error('Error al crear la orden');
    }
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
        <h3 className="text-sm font-semibold">Operar {symbol}</h3>
        <Badge variant="outline" size="sm">
          EIP-712 firmado off-chain
        </Badge>
      </div>

      <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')} className="px-4 pt-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy" className="data-[state=active]:text-success-fg">
            Comprar
          </TabsTrigger>
          <TabsTrigger value="sell" className="data-[state=active]:text-danger-fg">
            Vender
          </TabsTrigger>
        </TabsList>

        <TabsContent value={side} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="qty">Cantidad ({symbol})</Label>
            <Input
              id="qty"
              type="number"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min={1}
            />
            {side === 'sell' && (
              <p className="text-2xs text-foreground-tertiary tabular">
                Disponible: {balance.toLocaleString('es-MX')} {symbol}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Precio (USDC)</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.01"
            />
            <div className="flex items-center justify-between text-2xs">
              <span className="text-foreground-tertiary">
                Última: <span className="tabular">{lastPrice.toFixed(2)}</span>
              </span>
              <button
                type="button"
                onClick={() => setPrice(lastPrice.toFixed(2))}
                className="text-brand-400 hover:text-brand-300"
              >
                Usar último precio
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-elevated p-3">
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Subtotal</dt>
                <dd className="tabular">
                  <Money value={total} currency="USDC" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-secondary">Fee plataforma (0.50%)</dt>
                <dd className="tabular">
                  <Money value={fee} currency="USDC" />
                </dd>
              </div>
              <div className="flex justify-between border-t border-border-subtle pt-1.5">
                <dt className="font-medium">Total estimado</dt>
                <dd className="font-semibold tabular">
                  <Money value={side === 'buy' ? total + fee : total - fee} currency="USDC" />
                </dd>
              </div>
            </dl>
          </div>

          {insufficient && (
            <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-2.5 text-xs text-danger-fg">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No tienes suficiente saldo de {symbol} para esta orden.
            </div>
          )}

          <Button
            onClick={submit}
            disabled={!qty || !price || insufficient || create.isPending}
            className="w-full"
            variant={side === 'buy' ? 'success' : 'destructive'}
          >
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Firmando…
              </>
            ) : side === 'buy' ? (
              'Firmar orden de compra'
            ) : (
              'Firmar orden de venta'
            )}
          </Button>

          <div className="flex items-start gap-2 text-2xs text-foreground-tertiary">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success-fg" />
            La firma queda off-chain hasta que se ejecuta el match. Puedes cancelar gratis cuando
            quieras.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
