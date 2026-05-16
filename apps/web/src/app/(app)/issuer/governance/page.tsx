'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Progress,
  Skeleton,
} from '@hack/ui';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CreateProposalPanel } from '@/components/governance/CreateProposalPanel';
import { useAllProposals, type ProposalSummary, type ProposalStatus } from '@/hooks/useGovernance';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;
const SNOWSCAN_ADDR = (addr: string) => `https://testnet.snowscan.xyz/address/${addr}`;

function statusVariant(status: ProposalStatus) {
  switch (status) {
    case 'Active':
      return 'info' as const;
    case 'Passed':
      return 'success' as const;
    case 'Defeated':
      return 'danger' as const;
    case 'Tie':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}

function statusLabel(status: ProposalStatus): string {
  switch (status) {
    case 'Active':
      return 'Activa';
    case 'Passed':
      return 'Aprobada';
    case 'Defeated':
      return 'Rechazada';
    case 'Tie':
      return 'Empate';
    default:
      return 'Pendiente';
  }
}

function fmtDeadline(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(Number(unixSeconds) * 1000));
}

function votePct(votes: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Math.round(Number((votes * 100n) / total));
}

interface FinalizeButtonProps {
  proposal: ProposalSummary;
}

function FinalizeButton({ proposal }: FinalizeButtonProps) {
  const qc = useQueryClient();
  const gov = CONTRACT_ADDRESSES.governance;

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Propuesta finalizada', {
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
  }, [isMined, txHash, qc]);

  const handleFinalize = () => {
    if (!gov) return;
    writeContract(
      {
        address: gov as Address,
        abi: ABI.governance,
        functionName: 'finalize',
        args: [proposal.proposalId],
        chainId: avalancheFuji.id,
      },
      {
        onError(err) {
          const msg = err.message ?? '';
          if (msg.includes('VotingPeriodActive')) {
            toast.error('El periodo de votacion todavia esta activo');
          } else if (msg.includes('AlreadyFinalized')) {
            toast.error('Esta propuesta ya fue finalizada');
          } else {
            toast.error('Error al finalizar', { description: msg.slice(0, 120) });
          }
        },
      },
    );
  };

  const isPending = isWaitingWallet || isMining;

  return (
    <Button size="sm" variant="outline" onClick={handleFinalize} disabled={isPending || !gov}>
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          {isMining ? 'Confirmando...' : 'Esperando...'}
        </>
      ) : (
        'Finalizar'
      )}
    </Button>
  );
}

export default function IssuerGovernancePage() {
  const { data: proposals, isLoading } = useAllProposals();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Emisor', href: '/issuer' }, { label: 'Gobernanza' }]}
        title="Gobernanza on-chain"
        description="Crea propuestas de voto para los holders de ARKDEMO. Los resultados quedan registrados permanentemente en Avalanche Fuji."
        meta={
          CONTRACT_ADDRESSES.governance ? (
            <a
              href={SNOWSCAN_ADDR(CONTRACT_ADDRESSES.governance)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground-tertiary transition-colors hover:text-foreground-secondary"
            >
              Contrato verificado en Snowscan
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Proposals history */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Propuestas creadas</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <div className="space-y-3 px-6 pb-6">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !proposals || proposals.length === 0 ? (
                <div className="px-6 pb-6 pt-2 text-center text-sm text-foreground-secondary">
                  No hay propuestas todavia. Usa el panel a la derecha para crear la primera.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-elevated/40">
                      <tr className="border-b border-border-subtle text-2xs uppercase tracking-wider text-foreground-tertiary">
                        <th className="px-4 py-2.5 text-left font-medium">ID</th>
                        <th className="px-4 py-2.5 text-left font-medium">Descripcion</th>
                        <th className="px-4 py-2.5 text-left font-medium">Deadline</th>
                        <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                        <th className="px-4 py-2.5 text-left font-medium">Votos</th>
                        <th className="px-4 py-2.5 text-left font-medium">Detalle</th>
                        <th className="px-4 py-2.5 text-left font-medium">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {proposals.map((p) => {
                        const total = p.totalVotingPower;
                        const forPct = votePct(p.forVotes, total);
                        const againstPct = votePct(p.againstVotes, total);
                        const abstainPct = votePct(p.abstainVotes, total);
                        const canFinalize =
                          (p.status === 'Passed' ||
                            p.status === 'Defeated' ||
                            p.status === 'Tie') &&
                          !p.finalized;

                        return (
                          <tr
                            key={p.proposalId.toString()}
                            className="transition-colors hover:bg-elevated/30"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-foreground-secondary">
                              #{p.proposalId.toString()}
                            </td>
                            <td className="max-w-[200px] px-4 py-3">
                              <span
                                className="block truncate text-foreground"
                                title={p.description}
                              >
                                {p.description}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground-secondary">
                              {fmtDeadline(p.votingDeadline)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={statusVariant(p.status)} size="sm">
                                {statusLabel(p.status)}
                              </Badge>
                            </td>
                            <td className="min-w-[140px] px-4 py-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-12 text-right text-2xs tabular-nums text-success-fg">
                                    {forPct}% Si
                                  </span>
                                  <Progress value={forPct} tone="success" className="flex-1" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-12 text-right text-2xs tabular-nums text-danger-fg">
                                    {againstPct}% No
                                  </span>
                                  <Progress value={againstPct} tone="brand" className="flex-1" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-12 text-right text-2xs tabular-nums text-foreground-tertiary">
                                    {abstainPct}% Ab.
                                  </span>
                                  <Progress value={abstainPct} tone="warning" className="flex-1" />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/investor/governance/${p.proposalId.toString()}`}
                                className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                              >
                                Ver
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              {canFinalize ? (
                                <FinalizeButton proposal={p} />
                              ) : p.finalized ? (
                                <Badge variant="neutral" size="sm">
                                  Cerrada
                                </Badge>
                              ) : null}
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
        </div>

        {/* Sidebar: create panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <CreateProposalPanel />
        </aside>
      </div>
    </>
  );
}
