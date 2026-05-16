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
import { useCapTable } from '@/lib/client/queries/offerings';
import { useKycStatus } from '@/hooks/useKycStatus';
import { ABI, CONTRACT_ADDRESSES, FUJI_DEMO_TOKEN } from '@/lib/client/contracts';
import { ApproveDividendDistributorButton } from './ApproveDividendDistributorButton';
import { useQueryClient } from '@tanstack/react-query';

const DEMO_OFFERING_ID = '00000000-0000-4000-8000-000000000001';
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

  const [totalInput, setTotalInput] = useState('');
  const [rows, setRows] = useState<HolderRow[]>([]);
  const [kycWarnShown, setKycWarnShown] = useState(false);

  const { data: capTable, isLoading: capLoading } = useCapTable(DEMO_OFFERING_ID);

  // Load cap table rows into state
  const loadHolders = useCallback(() => {
    if (!capTable || capTable.length === 0) return;
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
  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
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

  const handleDeclare = () => {
    const distributor = CONTRACT_ADDRESSES.dividendDistributor;
    const usdc = CONTRACT_ADDRESSES.usdc;
    if (!distributor || !usdc || !address) return;

    const holders = rows.map((r) => r.wallet);
    const amounts = allocBigInts;

    writeContract({
      address: distributor as Address,
      abi: ABI.dividendDistributor,
      functionName: 'declare',
      args: [FUJI_DEMO_TOKEN, usdc as Address, holders, amounts],
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
          Arkangeles Demo Offering &middot; ARKDEMO
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
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
                  <th className="px-4 py-2.5 text-right font-medium">Balance ARKDEMO</th>
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

        {/* Declare button */}
        <Button className="w-full" onClick={handleDeclare} disabled={!isFormValid || isPending}>
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

        {!address && (
          <p className="text-center text-xs text-foreground-tertiary">
            Conecta tu wallet para declarar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
