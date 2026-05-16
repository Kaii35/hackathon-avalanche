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
  EmptyState,
  PageHeader,
  Progress,
  RelativeTime,
  Skeleton,
} from '@hack/ui';
import { ExternalLink, Loader2, Vote } from 'lucide-react';
import { toast } from 'sonner';
import {
  useVoterProposals,
  VOTE_TO_NUM,
  type ProposalSummary,
  type ProposalStatus,
  type VoterContext,
} from '@/hooks/useGovernance';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
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

// -------------------------------------------------------------------------
// Vote buttons sub-component (isolated to keep one writeContract per cast)
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
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-success-border text-success-fg hover:bg-success-bg/40"
        onClick={() => castVote('For')}
        disabled={isPending || !gov}
      >
        {isPending ? <Loader2 className="animate-spin" /> : null}
        Votar Si
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-danger-border text-danger-fg hover:bg-danger-bg/40"
        onClick={() => castVote('Against')}
        disabled={isPending || !gov}
      >
        Votar No
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => castVote('Abstain')}
        disabled={isPending || !gov}
      >
        Abstenerse
      </Button>
    </div>
  );
}

// -------------------------------------------------------------------------
// Proposal card
// -------------------------------------------------------------------------

interface ProposalCardProps {
  proposal: ProposalSummary & VoterContext;
}

function ProposalCard({ proposal: p }: ProposalCardProps) {
  const total = p.totalVotingPower;
  const forPct = votePct(p.forVotes, total);
  const againstPct = votePct(p.againstVotes, total);
  const abstainPct = votePct(p.abstainVotes, total);
  const deadlineDate = new Date(Number(p.votingDeadline) * 1000);

  return (
    <Card>
      <CardContent className="pt-5">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{p.description}</p>
            <p className="mt-0.5 font-mono text-2xs text-foreground-tertiary">
              Propuesta #{p.proposalId.toString()}
            </p>
          </div>
          <Badge variant={statusVariant(p.status)} size="sm">
            {statusLabel(p.status)}
          </Badge>
        </div>

        {/* Voter meta */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
          <span>
            Tu peso de voto:{' '}
            <span className="font-mono font-semibold text-foreground">
              {fmtWeight(p.votingPower)}
            </span>
          </span>
          <span>
            Total:{' '}
            <span className="font-mono text-foreground">{fmtWeight(p.totalVotingPower)}</span>
          </span>
          <span>
            {Date.now() < Number(p.votingDeadline) * 1000 ? (
              <>
                Termina <RelativeTime date={deadlineDate} />
              </>
            ) : (
              <>
                Cerro <RelativeTime date={deadlineDate} />
              </>
            )}
          </span>
        </div>

        {/* Vote distribution */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-24 text-right text-2xs tabular-nums text-success-fg">
              {forPct}% A favor
            </span>
            <Progress value={forPct} tone="success" className="flex-1" />
            <span className="w-20 text-right font-mono text-2xs tabular-nums text-foreground-tertiary">
              {fmtWeight(p.forVotes)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-right text-2xs tabular-nums text-danger-fg">
              {againstPct}% En contra
            </span>
            <Progress value={againstPct} tone="brand" className="flex-1" />
            <span className="w-20 text-right font-mono text-2xs tabular-nums text-foreground-tertiary">
              {fmtWeight(p.againstVotes)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 text-right text-2xs tabular-nums text-foreground-tertiary">
              {abstainPct}% Abstencion
            </span>
            <Progress value={abstainPct} tone="warning" className="flex-1" />
            <span className="w-20 text-right font-mono text-2xs tabular-nums text-foreground-tertiary">
              {fmtWeight(p.abstainVotes)}
            </span>
          </div>
        </div>

        {/* Actions / vote status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <div className="flex flex-wrap items-center gap-3">
            {p.status === 'Active' && !p.hasVoted ? (
              <VoteButtons proposalId={p.proposalId} />
            ) : p.hasVoted && p.vote ? (
              <Badge variant="info" size="sm">
                Tu voto: {voteLabel(p.vote)}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/investor/governance/${p.proposalId.toString()}`}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              Ver detalle
            </Link>
            {CONTRACT_ADDRESSES.governance && (
              <a
                href={SNOWSCAN_ADDR(CONTRACT_ADDRESSES.governance)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-foreground-tertiary hover:text-foreground-secondary"
              >
                Snowscan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default function InvestorGovernancePage() {
  const { address, realConnected } = useWallet();
  const { data: proposals, isLoading } = useVoterProposals(address ?? undefined);

  if (!realConnected) {
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Gobernanza' }]}
          title="Gobernanza"
          description="Vota en las propuestas activas del emisor."
        />
        <ConnectWalletPrompt description="Conecta tu wallet para ver las propuestas donde tienes voto." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Gobernanza' }]}
        title="Gobernanza"
        description="Propuestas activas donde tienes poder de voto como holder de ARKDEMO."
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !proposals || proposals.length === 0 ? (
        <EmptyState
          icon={<Vote className="h-6 w-6" />}
          title="No tienes voto en ninguna propuesta"
          description="El emisor te asignara poder de voto al crear una nueva propuesta. Cuando ocurra, aparecera aqui automaticamente."
        />
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <ProposalCard key={p.proposalId.toString()} proposal={p} />
          ))}
        </div>
      )}
    </>
  );
}
