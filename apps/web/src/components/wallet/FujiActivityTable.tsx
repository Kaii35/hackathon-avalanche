'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  WalletAddress,
} from '@hack/ui';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCcw, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFujiActivity } from '@/hooks/useFujiActivity';
import type { FujiTx } from '@/lib/client/fuji';

interface Props {
  wallet: `0x${string}`;
  limit?: number;
  title?: string;
  helper?: string;
}

const SNOWTRACE = 'https://testnet.snowtrace.io';

function fmtAmount(value: string, symbol: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} ${symbol}`;
  const formatted = n.toLocaleString('es-MX', {
    maximumFractionDigits: n >= 1 ? 4 : 6,
  });
  return `${formatted} ${symbol}`;
}

function DirectionBadge({
  direction,
  isError,
}: {
  direction: FujiTx['direction'];
  isError: boolean;
}) {
  if (isError) {
    return (
      <Badge variant="danger" size="sm">
        Falló
      </Badge>
    );
  }
  if (direction === 'in') {
    return (
      <Badge variant="success" size="sm">
        <ArrowDownLeft className="h-3 w-3" />
        Entró
      </Badge>
    );
  }
  if (direction === 'out') {
    return (
      <Badge variant="info" size="sm">
        <ArrowUpRight className="h-3 w-3" />
        Salió
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" size="sm">
      <Repeat className="h-3 w-3" />
      Self
    </Badge>
  );
}

export function FujiActivityTable({
  wallet,
  limit = 25,
  title = 'Actividad on-chain en Fuji',
  helper = 'Transacciones reales de tu wallet leídas en vivo del explorer público.',
}: Props) {
  const { data, isLoading, isFetching, refetch, error } = useFujiActivity(wallet, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="mt-0.5 text-xs text-foreground-tertiary">{helper}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Actualizar"
        >
          <RefreshCcw className={isFetching ? 'animate-spin' : ''} />
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="space-y-2 px-4 pb-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <EmptyState
            icon={<ExternalLink className="h-5 w-5" />}
            title="No pudimos leer la actividad"
            description="El explorer público no respondió. Intenta refrescar en unos segundos."
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Repeat className="h-5 w-5" />}
            title="Sin actividad on-chain todavía"
            description="Cuando recibas o envíes AVAX o cualquier token en Fuji, aparecerá aquí."
            action={
              <Button variant="secondary" size="sm" asChild>
                <a href="https://faucet.avax.network/" target="_blank" rel="noopener noreferrer">
                  Pedir AVAX al faucet
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-2xs uppercase tracking-wider text-foreground-tertiary">
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-2 text-left font-medium">Dirección</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                  <th className="px-4 py-2 text-left font-medium">Contraparte</th>
                  <th className="px-4 py-2 text-left font-medium">Tx</th>
                  <th className="px-4 py-2 text-right font-medium">Cuándo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.map((tx) => {
                  const counterparty =
                    tx.direction === 'in' ? tx.from : tx.direction === 'out' ? tx.to : tx.from;
                  return (
                    <tr key={`${tx.hash}-${tx.type}-${tx.from}-${tx.to}`}>
                      <td className="px-4 py-2.5">
                        <DirectionBadge direction={tx.direction} isError={tx.isError} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" size="sm">
                          {tx.type === 'native' ? 'AVAX' : tx.symbol}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                        {fmtAmount(tx.value, tx.symbol)}
                      </td>
                      <td className="px-4 py-2.5">
                        <WalletAddress address={counterparty} size="sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`${SNOWTRACE}/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-brand-400 hover:text-brand-300"
                        >
                          {tx.hash.slice(0, 10)}…
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-foreground-tertiary tabular">
                        {format(new Date(tx.timestamp), 'd MMM HH:mm', { locale: es })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
