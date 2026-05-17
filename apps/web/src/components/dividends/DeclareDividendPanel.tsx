'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { parseUnits, formatUnits, type Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  WalletAddress,
} from '@hack/ui';
import { AlertTriangle, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useCapTable, useOfferings } from '@/lib/client/queries/offerings';
import { useKycStatus } from '@/hooks/useKycStatus';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { ApproveDividendDistributorButton } from './ApproveDividendDistributorButton';
import { useQueryClient } from '@tanstack/react-query';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;

// USDC has 6 decimals
const USDC_DECIMALS = 6;

interface HolderRow {
  wallet: Address;
  balance: bigint;
  allocationInput: string; // human-readable USDC e.g. "17.00"
}

function parseUsdcInput(v: string): bigint {
  try {
    return parseUnits(v.trim() || '0', USDC_DECIMALS);
  } catch {
    return 0n;
  }
}

function formatUsdc(v: bigint): string {
  return formatUnits(v, USDC_DECIMALS);
}

/** Compute pro-rata allocations with BigInt math. Last holder absorbs the remainder. */
function computeProRata(totalUsdc: bigint, balances: bigint[]): bigint[] {
  const sumBalances = balances.reduce((a, b) => a + b, 0n);
  if (sumBalances === 0n || totalUsdc === 0n) return balances.map(() => 0n);

  const allocs: bigint[] = balances.map((bal) => (totalUsdc * bal) / sumBalances);
  const distributed = allocs.reduce((a, b) => a + b, 0n);
  const remainder = totalUsdc - distributed;
  // Last holder absorbs remainder so sum == totalUsdc exactly
  const lastIdx = allocs.length - 1;
  if (lastIdx >= 0) allocs[lastIdx] = (allocs[lastIdx] ?? 0n) + remainder;
  return allocs;
}

interface KycWarningProps {
  wallet: Address;
}

function KycWarning({ wallet }: KycWarningProps) {
  const { verified } = useKycStatus(wallet);
  if (verified === true || verified === undefined) return null;
  return (
    <span
      title="Holder no verificado en IdentityRegistry"
      className="ml-1 inline-flex items-center"
    >
      <AlertTriangle className="h-3 w-3 text-warning-fg" />
    </span>
  );
}

export function DeclareDividendPanel() {
  const { address } = useAccount();
  const qc = useQueryClient();

  // Lista las ofertas del issuer logueado. Auto-selecciona la primera.
  const { data: myOfferings } = useOfferings({ mine: true });
  const offerings = myOfferings ?? [];
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');

  useEffect(() => {
    if (!selectedOfferingId && offerings.length > 0 && offerings[0]) {
      setSelectedOfferingId(offerings[0].id);
    }
  }, [offerings, selectedOfferingId]);

  const selectedOffering = offerings.find((o) => o.id === selectedOfferingId);
  const tokenAddress = (selectedOffering?.tokenAddress ?? '') as Address;

  const [totalInput, setTotalInput] = useState('');
  const [rows, setRows] = useState<HolderRow[]>([]);
  const [kycWarnShown, setKycWarnShown] = useState(false);

  const { data: capTable, isLoading: capLoading } = useCapTable(selectedOfferingId || undefined);

  // Limpia los holders al cambiar de oferta — se vuelven a cargar al pulsar el botón.
  useEffect(() => {
    setRows([]);
  }, [selectedOfferingId]);

  // Load cap table rows into state
  const loadHolders = useCallback(() => {
    if (!capTable) {
      toast.error('Cap table no disponible todavía');
      return;
    }
    if (capTable.length === 0) {
      toast.error('No hay holders para esta oferta', {
        description:
          'Necesitas mintear o tener al menos un holder en el cap table antes de declarar un dividendo.',
      });
      return;
    }
    const totalUsdc = parseUsdcInput(totalInput);
    const balances = capTable.map((r) => BigInt(r.balance));
    const allocs = computeProRata(totalUsdc, balances);
    setRows(
      capTable.map((r, i) => ({
        wallet: r.wallet as Address,
        balance: BigInt(r.balance),
        allocationInput: formatUsdc(allocs[i] ?? 0n),
      })),
    );
  }, [capTable, totalInput]);

  // Recompute pro-rata whenever total changes (only if rows are already loaded)
  useEffect(() => {
    if (rows.length === 0) return;
    const totalUsdc = parseUsdcInput(totalInput);
    const balances = rows.map((r) => r.balance);
    const allocs = computeProRata(totalUsdc, balances);
    setRows((prev) => prev.map((r, i) => ({ ...r, allocationInput: formatUsdc(allocs[i] ?? 0n) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalInput]);

  const updateAllocation = (idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, allocationInput: value } : r)));
  };

  // Derived totals
  const totalInputBigInt = parseUsdcInput(totalInput);
  const allocBigInts = rows.map((r) => parseUsdcInput(r.allocationInput));
  const allocSum = allocBigInts.reduce((a, b) => a + b, 0n);

  // Validation
  const hasDuplicates = useMemo(() => {
    const wallets = rows.map((r) => r.wallet.toLowerCase());
    return new Set(wallets).size !== wallets.length;
  }, [rows]);

  const zeroAmountHolders = allocBigInts.some((a) => a === 0n) && rows.length > 0;

  const sumMismatch = totalInputBigInt > 0n && rows.length > 0 && allocSum !== totalInputBigInt;

  const isFormValid =
    rows.length > 0 &&
    totalInputBigInt > 0n &&
    !hasDuplicates &&
    !zeroAmountHolders &&
    !sumMismatch;

  // Write contract
  const {
    data: txHash,
    writeContract,
    isPending: isWaitingWallet,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const {
    isLoading: isMining,
    isSuccess: isMined,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Dividendo declarado', {
      description: (
        <a
          href={SNOWSCAN_TX(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Ver en Snowscan
        </a>
      ),
    });
    // Invalidate dividends query so useAllDividends refetches
    void qc.invalidateQueries({ queryKey: ['dividends'] });
    setTotalInput('');
    setRows([]);
  }, [isMined, txHash, qc]);

  // Surface wallet rejection / chain errors that wagmi captures pero que de
  // otra forma quedarían silenciosos (el caso típico: usuario cancela, allowance
  // insuficiente, o chain id distinto a Fuji).
  useEffect(() => {
    if (!writeError) return;
    const msg = (writeError as Error).message ?? 'Error al enviar la transacción';
    toast.error('No se pudo declarar el dividendo', {
      description: msg.slice(0, 240),
    });
    resetWrite();
  }, [writeError, resetWrite]);

  useEffect(() => {
    if (!receiptError) return;
    toast.error('La transacción se revirtió en la red', {
      description: (receiptError as Error).message?.slice(0, 240) ?? '',
    });
  }, [receiptError]);

  const handleDeclare = () => {
    const distributor = CONTRACT_ADDRESSES.dividendDistributor;
    const usdc = CONTRACT_ADDRESSES.usdc;
    if (!address) {
      toast.error('Conecta tu wallet para declarar');
      return;
    }
    if (!distributor || !usdc) {
      const missing = [
        !distributor && 'NEXT_PUBLIC_DIVIDEND_DISTRIBUTOR',
        !usdc && 'NEXT_PUBLIC_USDC',
      ]
        .filter(Boolean)
        .join(', ');
      toast.error('Contratos no configurados', {
        description: `Falta ${missing}. Si ya están en el .env, reinicia "pnpm dev" — las NEXT_PUBLIC_* se inyectan al compilar el bundle.`,
      });
      return;
    }
    if (!tokenAddress || tokenAddress.length === 0) {
      toast.error('Selecciona una oferta primero');
      return;
    }
    if (rows.length === 0) {
      toast.error('Carga los holders desde el cap table', {
        description: 'Pulsa "Cargar holders desde cap table" antes de declarar.',
      });
      return;
    }
    if (totalInputBigInt === 0n) {
      toast.error('Ingresa un monto total mayor a 0');
      return;
    }
    if (hasDuplicates) {
      toast.error('Hay wallets duplicadas en la lista');
      return;
    }
    if (zeroAmountHolders) {
      toast.error('Todos los holders deben tener un monto mayor a 0');
      return;
    }
    if (sumMismatch) {
      toast.error('La suma de allocations no coincide con el monto total');
      return;
    }

    const holders = rows.map((r) => r.wallet);
    const amounts = allocBigInts;

    writeContract({
      address: distributor as Address,
      abi: ABI.dividendDistributor,
      functionName: 'declare',
      args: [tokenAddress, usdc as Address, holders, amounts],
      chainId: avalancheFuji.id,
    });
  };

  const isPending = isWaitingWallet || isMining;

  if (!address) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-foreground-secondary">
          Conecta tu wallet para declarar dividendos.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Declarar dividendo</CardTitle>
        <p className="text-sm text-foreground-secondary">
          {selectedOffering
            ? `${selectedOffering.name} · ${selectedOffering.symbol}`
            : 'Selecciona la oferta sobre la que vas a distribuir'}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Offering selector — solo aparece si el issuer tiene >1 oferta. */}
        {offerings.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="divOffering">Oferta</Label>
            <select
              id="divOffering"
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.symbol}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Total amount input */}
        <div className="space-y-1.5">
          <Label htmlFor="totalUsdc">Monto total a distribuir (USDC)</Label>
          <Input
            id="totalUsdc"
            type="number"
            inputMode="decimal"
            placeholder="Ej: 1000.00"
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            step="0.000001"
            min="0"
          />
          {totalInputBigInt === 0n && totalInput.length > 0 && (
            <p className="text-2xs text-danger-fg">El monto debe ser mayor a 0.</p>
          )}
        </div>

        {/* Load holders */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHolders}
            disabled={capLoading || !capTable}
          >
            {capLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <RefreshCw />
                Cargar holders desde cap table
              </>
            )}
          </Button>
          {rows.length > 0 && (
            <span className="text-sm text-foreground-secondary">
              {rows.length} holder{rows.length !== 1 ? 's' : ''} cargados
            </span>
          )}
        </div>

        {/* Holders table */}
        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-elevated/60">
                <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                  <th className="px-4 py-2.5 text-left font-medium">Holder</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Balance {selectedOffering?.symbol ?? 'tokens'}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">USDC a recibir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row, idx) => (
                  <tr key={row.wallet}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <WalletAddress address={row.wallet} size="sm" />
                        <KycWarning wallet={row.wallet} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground-secondary">
                      {Number(row.balance).toLocaleString('es-MX')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={row.allocationInput}
                        onChange={(e) => updateAllocation(idx, e.target.value)}
                        className="h-7 w-32 text-right text-xs"
                        step="0.000001"
                        min="0"
                        aria-invalid={parseUsdcInput(row.allocationInput) === 0n}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-elevated/40">
                <tr>
                  <td className="px-4 py-2.5 text-sm font-semibold" colSpan={2}>
                    Total allocations
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                      sumMismatch ? 'text-danger-fg' : 'text-foreground'
                    }`}
                  >
                    {Number(formatUsdc(allocSum)).toLocaleString('es-MX', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    USDC
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Validation messages */}
        {hasDuplicates && (
          <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg/40 px-3 py-2 text-xs text-danger-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Hay wallets duplicadas en la lista.
          </div>
        )}
        {zeroAmountHolders && rows.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg/40 px-3 py-2 text-xs text-danger-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Todos los holders deben tener un monto mayor a 0. El contrato rechaza montos en cero.
          </div>
        )}
        {sumMismatch && (
          <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg/40 px-3 py-2 text-xs text-warning-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            La suma de allocations (
            {Number(formatUsdc(allocSum)).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })}{' '}
            USDC) no coincide con el monto total (
            {Number(formatUsdc(totalInputBigInt)).toLocaleString('es-MX', {
              minimumFractionDigits: 2,
            })}{' '}
            USDC).
          </div>
        )}

        {/* KYC soft-warning: checked lazily, shown once triggered */}
        {!kycWarnShown && rows.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-info-border bg-info-bg/40 px-3 py-2 text-xs text-info-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Los holders marcados con <AlertTriangle className="inline h-3 w-3 text-warning-fg" />{' '}
              no estan verificados en el IdentityRegistry. Los pagos USDC se enviaran igualmente al
              reclamar; verifica si es esperado.
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 text-info-fg/60 hover:text-info-fg"
              onClick={() => setKycWarnShown(true)}
            >
              Entendido
            </button>
          </div>
        )}

        {/* Approve USDC for the distributor */}
        {isFormValid && <ApproveDividendDistributorButton requiredAmount={totalInputBigInt} />}

        {/* Declare button — siempre clickeable salvo mientras espera wallet/red;
            la validación se hace dentro de handleDeclare y avisa por toast para
            que el usuario sepa qué falta en lugar de ver un botón gris sin pista. */}
        <Button className="w-full" onClick={handleDeclare} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              {isMining ? 'Confirmando en red...' : 'Esperando wallet...'}
            </>
          ) : isMined ? (
            <>
              <CheckCircle2 />
              Dividendo declarado
            </>
          ) : (
            'Declarar dividendo'
          )}
        </Button>
        {!isFormValid && !isPending && (
          <p className="text-center text-2xs text-foreground-tertiary">
            {rows.length === 0
              ? 'Carga los holders desde el cap table para continuar.'
              : totalInputBigInt === 0n
                ? 'Ingresa el monto total a distribuir.'
                : hasDuplicates
                  ? 'Hay wallets duplicadas en la lista.'
                  : zeroAmountHolders
                    ? 'Todos los holders deben tener un monto > 0.'
                    : sumMismatch
                      ? 'La suma de allocations no coincide con el total.'
                      : 'Completa los datos para declarar.'}
          </p>
        )}

        {!address && (
          <p className="text-center text-xs text-foreground-tertiary">
            Conecta tu wallet para declarar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
