'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  KeyValueList,
  PageHeader,
  Progress,
  RelativeTime,
  Skeleton,
} from '@hack/ui';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useVoterProposals,
  useAllProposals,
  VOTE_TO_NUM,
  type ProposalSummary,
  type ProposalStatus,
  type VoterContext,
} from '@/hooks/useGovernance';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { useWallet } from '@/hooks/useWallet';

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

function voteLabel(vote: 'Against' | 'For' | 'Abstain'): string {
  switch (vote) {
    case 'For':
      return 'A favor';
    case 'Against':
      return 'En contra';
    case 'Abstain':
      return 'Abstencion';
  }
}

function votePct(votes: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Math.round(Number((votes * 100n) / total));
}

function fmtWeight(w: bigint): string {
  return Number(w).toLocaleString('es-MX');
}

function fmtDate(unixSeconds: bigint): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(Number(unixSeconds) * 1000));
}

// -------------------------------------------------------------------------
// Vote buttons
// -------------------------------------------------------------------------

interface VoteButtonsProps {
  proposalId: bigint;
}

function VoteButtons({ proposalId }: VoteButtonsProps) {
  const qc = useQueryClient();
  const gov = CONTRACT_ADDRESSES.governance;

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Voto registrado', {
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

  const castVote = (option: keyof typeof VOTE_TO_NUM) => {
    if (!gov) return;
    writeContract(
      {
        address: gov as Address,
        abi: ABI.governance,
        functionName: 'castVote',
        args: [proposalId, VOTE_TO_NUM[option]],
        chainId: avalancheFuji.id,
      },
      {
        onError(err) {
          const msg = err.message ?? '';
          if (msg.includes('AlreadyVoted')) {
            toast.error('Ya registraste tu voto en esta propuesta');
          } else if (msg.includes('VotingPeriodEnded')) {
            toast.error('El periodo de votacion ya cerro');
          } else if (msg.includes('NoVotingPower')) {
            toast.error('No tienes poder de voto en esta propuesta');
          } else {
            toast.error('Error al votar', { description: msg.slice(0, 120) });
          }
        },
      },
    );
  };

  const isPending = isWaitingWallet || isMining;

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        className="border-success-border text-success-fg hover:bg-success-bg/40"
        onClick={() => castVote('For')}
        disabled={isPending || !gov}
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        Votar Si
      </Button>
      <Button
        variant="outline"
        className="border-danger-border text-danger-fg hover:bg-danger-bg/40"
        onClick={() => castVote('Against')}
        disabled={isPending || !gov}
      >
        Votar No
      </Button>
      <Button variant="outline" onClick={() => castVote('Abstain')} disabled={isPending || !gov}>
        Abstenerse
      </Button>
    </div>
  );
}

// -------------------------------------------------------------------------
// Detail content (shared between connected and unconnected state)
// -------------------------------------------------------------------------

interface DetailContentProps {
  proposal: ProposalSummary;
  voterCtx: VoterContext | null;
}

function DetailContent({ proposal: p, voterCtx }: DetailContentProps) {
  const total = p.totalVotingPower;
  const forPct = votePct(p.forVotes, total);
  const againstPct = votePct(p.againstVotes, total);
  const abstainPct = votePct(p.abstainVotes, total);
  const deadlineDate = new Date(Number(p.votingDeadline) * 1000);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main */}
      <div className="space-y-6">
        {/* Status + description */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle>{p.description}</CardTitle>
              <Badge variant={statusVariant(p.status)} size="md">
                {statusLabel(p.status)}
              </Badge>
            </div>
            <p className="font-mono text-2xs text-foreground-tertiary">
              Propuesta #{p.proposalId.toString()}
            </p>
          </CardHeader>
          <CardContent>
            <KeyValueList
              items={[
                {
                  label: 'Creada por',
                  value: (
                    <span className="font-mono text-xs">
                      {p.proposedBy.slice(0, 6)}...{p.proposedBy.slice(-4)}
                    </span>
                  ),
                },
                {
                  label: 'Deadline de votacion',
                  value: fmtDate(p.votingDeadline),
                },
                {
                  label: 'Tiempo restante',
                  value: <RelativeTime date={deadlineDate} />,
                },
                {
                  label: 'Token',
                  value: (
                    <span className="font-mono text-xs">
                      {p.token.slice(0, 6)}...{p.token.slice(-4)}
                    </span>
                  ),
                },
                {
                  label: 'Holders votantes',
                  value: p.holderCount.toString(),
                },
                {
                  label: 'Finalizada',
                  value: p.finalized ? 'Si' : 'No',
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Vote distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribucion de votos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-success-fg font-medium">A favor</span>
                <span className="font-mono tabular-nums text-foreground-secondary">
                  {fmtWeight(p.forVotes)} / {fmtWeight(total)} ({forPct}%)
                </span>
              </div>
              <Progress value={forPct} tone="success" className="h-2.5" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-danger-fg font-medium">En contra</span>
                <span className="font-mono tabular-nums text-foreground-secondary">
                  {fmtWeight(p.againstVotes)} / {fmtWeight(total)} ({againstPct}%)
                </span>
              </div>
              <Progress value={againstPct} tone="brand" className="h-2.5" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-secondary font-medium">Abstencion</span>
                <span className="font-mono tabular-nums text-foreground-secondary">
                  {fmtWeight(p.abstainVotes)} / {fmtWeight(total)} ({abstainPct}%)
                </span>
              </div>
              <Progress value={abstainPct} tone="warning" className="h-2.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: voter actions */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tu voto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {voterCtx ? (
              <>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-secondary">Tu peso</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {fmtWeight(voterCtx.votingPower)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-secondary">Total</span>
                    <span className="font-mono tabular-nums">{fmtWeight(total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-secondary">Participacion</span>
                    <span className="font-mono tabular-nums">
                      {votePct(voterCtx.votingPower, total)}%
                    </span>
                  </div>
                </div>

                {p.status === 'Active' && !voterCtx.hasVoted ? (
                  <VoteButtons proposalId={p.proposalId} />
                ) : voterCtx.hasVoted && voterCtx.vote ? (
                  <div className="rounded-md border border-info-border bg-info-bg/40 px-3 py-2 text-sm text-info-fg">
                    Registraste tu voto:{' '}
                    <span className="font-semibold">{voteLabel(voterCtx.vote)}</span>
                  </div>
                ) : (
                  <p className="text-sm text-foreground-secondary">
                    La votacion esta cerrada. {statusLabel(p.status)}.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground-secondary">
                No tienes poder de voto en esta propuesta.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Snowscan link */}
        {CONTRACT_ADDRESSES.governance && (
          <a
            href={SNOWSCAN_ADDR(CONTRACT_ADDRESSES.governance)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-foreground-tertiary hover:text-foreground-secondary"
          >
            Ver contrato en Snowscan
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </aside>
    </div>
  );
}

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default function GovernanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const proposalId = BigInt(id ?? '0');

  const { address } = useWallet();

  // Read all proposals to find this one (small list, acceptable for MVP)
  const { data: allProposals, isLoading: allLoading } = useAllProposals();
  const proposal = allProposals?.find((p) => p.proposalId === proposalId);

  // If wallet connected, get voter context for this proposal only
  const { data: voterProposals, isLoading: voterLoading } = useVoterProposals(address ?? undefined);
  const voterCtx = voterProposals?.find((p) => p.proposalId === proposalId) ?? null;

  const isLoading = allLoading || voterLoading;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Inversionista', href: '/investor' },
          { label: 'Gobernanza', href: '/investor/governance' },
          { label: `Propuesta #${id}` },
        ]}
        title={proposal?.description ?? `Propuesta #${id}`}
        description="Detalle de la propuesta de gobernanza on-chain."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/investor/governance">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a lista
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !proposal ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-foreground-secondary">
            Propuesta #{id} no encontrada. Puede que el ID sea incorrecto o que el contrato no tenga
            propuestas aun.
          </CardContent>
        </Card>
      ) : (
        <DetailContent proposal={proposal} voterCtx={voterCtx} />
      )}
    </>
  );
}
