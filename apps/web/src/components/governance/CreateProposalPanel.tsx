'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Address } from 'viem';
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
  Textarea,
  WalletAddress,
} from '@hack/ui';
import { AlertTriangle, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCapTable } from '@/lib/client/queries/offerings';
import { useKycStatus } from '@/hooks/useKycStatus';
import { ABI, CONTRACT_ADDRESSES, FUJI_DEMO_TOKEN } from '@/lib/client/contracts';

const DEMO_OFFERING_ID = '00000000-0000-4000-8000-000000000001';
const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;

/** Default voting deadline = now + 7 days, formatted as datetime-local string */
function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // datetime-local format: "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface HolderRow {
  wallet: Address;
  weightInput: string; // editable bigint string (token base units)
}

function parseWeight(v: string): bigint {
  try {
    const trimmed = v.trim();
    if (!trimmed || trimmed === '0') return 0n;
    return BigInt(trimmed);
  } catch {
    return 0n;
  }
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

export function CreateProposalPanel() {
  const { address } = useAccount();
  const qc = useQueryClient();

  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<string>(defaultDeadline);
  const [rows, setRows] = useState<HolderRow[]>([]);
  const [kycWarnShown, setKycWarnShown] = useState(false);

  const { data: capTable, isLoading: capLoading } = useCapTable(DEMO_OFFERING_ID);

  const loadHolders = useCallback(() => {
    if (!capTable || capTable.length === 0) return;
    setRows(
      capTable.map((r) => ({
        wallet: r.wallet as Address,
        // Use token balance as weight (already in base units from cap table)
        weightInput: r.balance,
      })),
    );
  }, [capTable]);

  const updateWeight = (idx: number, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, weightInput: value } : r)));
  };

  // Derived validation
  const weights = rows.map((r) => parseWeight(r.weightInput));

  const hasDuplicates = useMemo(() => {
    const wallets = rows.map((r) => r.wallet.toLowerCase());
    return new Set(wallets).size !== wallets.length;
  }, [rows]);

  const hasZeroWeight = weights.some((w) => w === 0n) && rows.length > 0;

  const deadlineTs = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : 0;
  const deadlineValid = deadlineTs > Math.floor(Date.now() / 1000) + 60;

  const descriptionValid = description.trim().length > 0;

  const isFormValid =
    descriptionValid && deadlineValid && rows.length > 0 && !hasDuplicates && !hasZeroWeight;

  // Write contract
  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Propuesta creada', {
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
    void qc.invalidateQueries({ queryKey: ['governance'] });
    setDescription('');
    setDeadline(defaultDeadline());
    setRows([]);
  }, [isMined, txHash, qc]);

  const handlePropose = () => {
    const gov = CONTRACT_ADDRESSES.governance;
    if (!gov || !address) return;

    const holders = rows.map((r) => r.wallet);

    writeContract(
      {
        address: gov as Address,
        abi: ABI.governance,
        functionName: 'propose',
        args: [FUJI_DEMO_TOKEN, description.trim(), holders, weights, BigInt(deadlineTs)],
        chainId: avalancheFuji.id,
      },
      {
        onError(err) {
          const msg = err.message ?? '';
          if (msg.includes('NotIssuerAdmin')) {
            toast.error('Solo el issuer admin del token puede crear propuestas');
          } else {
            toast.error('Error al crear la propuesta', { description: msg.slice(0, 120) });
          }
        },
      },
    );
  };

  const isPending = isWaitingWallet || isMining;

  if (!address) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-foreground-secondary">
          Conecta tu wallet para crear propuestas.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva propuesta</CardTitle>
        <p className="text-sm text-foreground-secondary">
          Arkangeles Demo Offering &middot; ARKDEMO
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="propDescription">Descripcion de la propuesta</Label>
          <Textarea
            id="propDescription"
            placeholder='Ej: "Aprobar dividendo Q2 2026" o "Drag-along sobre 50% del cap table"'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            invalid={description.length > 0 && !descriptionValid}
            rows={3}
          />
          {description.length > 0 && !descriptionValid && (
            <p className="text-2xs text-danger-fg">La descripcion no puede estar vacia.</p>
          )}
        </div>

        {/* Voting deadline */}
        <div className="space-y-1.5">
          <Label htmlFor="propDeadline">Deadline para votacion</Label>
          <Input
            id="propDeadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          {deadline && !deadlineValid && (
            <p className="text-2xs text-danger-fg">
              El deadline debe ser al menos 1 minuto en el futuro.
            </p>
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
                  <th className="px-4 py-2.5 text-right font-medium">Peso (tokens)</th>
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
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={row.weightInput}
                        onChange={(e) => updateWeight(idx, e.target.value)}
                        className="h-7 w-36 text-right font-mono text-xs"
                        aria-invalid={parseWeight(row.weightInput) === 0n}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
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
        {hasZeroWeight && (
          <div className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg/40 px-3 py-2 text-xs text-danger-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Todos los holders deben tener un peso mayor a 0.
          </div>
        )}

        {/* KYC soft-warning */}
        {!kycWarnShown && rows.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-info-border bg-info-bg/40 px-3 py-2 text-xs text-info-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Los holders marcados con <AlertTriangle className="inline h-3 w-3 text-warning-fg" />{' '}
              no estan verificados en el IdentityRegistry. Podran votar igualmente si el contrato
              les asigno poder de voto.
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

        {/* Submit */}
        <Button className="w-full" onClick={handlePropose} disabled={!isFormValid || isPending}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              {isMining ? 'Confirmando en red...' : 'Esperando wallet...'}
            </>
          ) : isMined ? (
            <>
              <CheckCircle2 />
              Propuesta creada
            </>
          ) : (
            'Crear propuesta'
          )}
        </Button>

        {/* Badge legend */}
        {rows.length === 0 && !capLoading && (
          <p className="text-center text-xs text-foreground-tertiary">
            Carga los holders del cap table para habilitar el boton.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
