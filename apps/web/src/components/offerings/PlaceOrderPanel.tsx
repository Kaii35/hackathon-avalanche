'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { parseUnits, type Address } from 'viem';
import { useAccount } from 'wagmi';
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
import { Loader2, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { useCreateOrder } from '@/lib/client/queries/orderbook';
import { useKycStatus } from '@/hooks/useKycStatus';
import { CONTRACT_ADDRESSES, FUJI_DEMO_TOKEN } from '@/lib/client/contracts';
import { ApproveSettlementButton } from './ApproveSettlementButton';
import { toast } from 'sonner';

// Inline validation helpers
function isPositiveInteger(v: string): boolean {
  return /^\d+$/.test(v.trim()) && parseInt(v, 10) > 0;
}
function isValidPrice(v: string): boolean {
  if (!v || isNaN(Number(v)) || Number(v) <= 0) return false;
  const parts = v.split('.');
  return !parts[1] || parts[1].length <= 6;
}

export function PlaceOrderPanel({
  offeringId,
  tokenAddress,
  symbol,
  lastPrice,
  balance = 0,
}: {
  offeringId: string;
  /** On-chain address of the SecurityToken for this offering. */
  tokenAddress?: Address;
  symbol: string;
  lastPrice: number;
  balance?: number;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('100');
  const [price, setPrice] = useState(lastPrice.toFixed(2));
  const create = useCreateOrder();
  const { address } = useAccount();
  const kyc = useKycStatus(address ?? null);

  // Resolve token: use prop, fall back to demo constant
  const resolvedToken: Address = tokenAddress ?? FUJI_DEMO_TOKEN;
  const usdcAddress = CONTRACT_ADDRESSES.usdc ?? undefined;

  const total = useMemo(() => Number(qty || '0') * Number(price || '0'), [qty, price]);
  const fee = total * 0.005;

  const qtyError = qty && !isPositiveInteger(qty) ? 'Ingresa un número entero positivo' : null;
  const priceError =
    price && !isValidPrice(price) ? 'Precio inválido (máx. 6 decimales, mayor a 0)' : null;
  const insufficient = side === 'sell' && Number(qty) > balance;

  // Required base units for the allowance check
  const requiredBaseUnits = useMemo((): bigint => {
    try {
      if (side === 'buy' && price && total > 0) {
        return parseUnits(total.toFixed(6), 6);
      }
      if (side === 'sell' && qty && isPositiveInteger(qty)) {
        return parseUnits(qty, 18);
      }
    } catch {
      // parseUnits throws on malformed input — treat as 0
    }
    return 0n;
  }, [side, qty, price, total]);

  const canSign =
    !!qty && !!price && !qtyError && !priceError && !insufficient && !create.isPending && !!address;

  const submit = async () => {
    if (!canSign) return;
    try {
      const order = await create.mutateAsync({
        offeringId,
        tokenAddress: resolvedToken,
        side,
        qty,
        price,
      });
      toast.success(`Orden ${side === 'buy' ? 'de compra' : 'de venta'} enviada`, {
        description: (
          <span>
            {qty} {symbol} @ {price} USDC &mdash;{' '}
            <Link href="/investor/orders" className="underline">
              Ver mis órdenes
            </Link>
          </span>
        ),
        duration: 6000,
      });
      // Log order hash for debugging without exposing PII
      if (process.env.NODE_ENV === 'development' && order && 'orderHash' in order) {
        console.debug('[PlaceOrderPanel] orderHash', (order as { orderHash: string }).orderHash);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // User cancelled the wallet prompt — not an error, just a notice
      if (/user (rejected|denied|cancelled|canceled)/i.test(msg)) {
        toast.info('Firma cancelada por el usuario');
      } else {
        toast.error('Error al crear la orden', { description: msg });
      }
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

      {/* KYC warning — informational only, does not block order placement */}
      {address && kyc.verified === false && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-2.5 text-xs text-warning-fg">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Tu wallet no está KYC-verificada. Las órdenes que firmes no se podrán ejecutar hasta
          completar KYC.
        </div>
      )}

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
          {/* Qty field */}
          <div className="space-y-1.5">
            <Label htmlFor="qty">Cantidad ({symbol})</Label>
            <Input
              id="qty"
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min={1}
              step={1}
              aria-invalid={Boolean(qtyError)}
            />
            {qtyError && <p className="text-2xs text-danger-fg">{qtyError}</p>}
            {side === 'sell' && !qtyError && (
              <p className="text-2xs text-foreground-tertiary tabular">
                Disponible: {balance.toLocaleString('es-MX')} {symbol}
              </p>
            )}
          </div>

          {/* Price field */}
          <div className="space-y-1.5">
            <Label htmlFor="price">Precio (USDC)</Label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.000001"
              aria-invalid={Boolean(priceError)}
            />
            {priceError && <p className="text-2xs text-danger-fg">{priceError}</p>}
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

          {/* Order summary */}
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

          {/* Insufficient balance warning */}
          {insufficient && (
            <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-2.5 text-xs text-danger-fg">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No tienes suficiente saldo de {symbol} para esta orden.
            </div>
          )}

          {/* Approve button — rendered only when allowance is insufficient */}
          {address && requiredBaseUnits > 0n && (
            <ApproveSettlementButton
              side={side}
              tokenAddress={resolvedToken}
              paymentToken={usdcAddress}
              requiredAmount={requiredBaseUnits}
              symbol={side === 'buy' ? 'USDC' : symbol}
            />
          )}

          {/* Sign button */}
          <Button
            onClick={() => void submit()}
            disabled={!canSign}
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
