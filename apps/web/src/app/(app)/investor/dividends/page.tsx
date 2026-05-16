'use client';

import { useEffect } from 'react';
import { formatUnits, type Address } from 'viem';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Money,
  PageHeader,
  Skeleton,
} from '@hack/ui';
import { Coins, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimableDividends, type ClaimableDividend } from '@/hooks/useDividends';
import { ABI, CONTRACT_ADDRESSES, FUJI_DEMO_TOKEN } from '@/lib/client/contracts';
import { ConnectWalletPrompt } from '@/components/wallet/ConnectWalletPrompt';
import { useWallet } from '@/hooks/useWallet';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;
const USDC_DECIMALS = 6;

function offeringLabel(token: Address): string {
  if (token.toLowerCase() === FUJI_DEMO_TOKEN.toLowerCase()) {
    return 'Arkangeles Demo Offering · ARKDEMO';
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function fmtUsdc(v: bigint): number {
  return Number(formatUnits(v, USDC_DECIMALS));
}

interface ClaimButtonProps {
  dividend: ClaimableDividend;
}

function ClaimButton({ dividend }: ClaimButtonProps) {
  const qc = useQueryClient();
  const distributor = CONTRACT_ADDRESSES.dividendDistributor;

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Dividendo reclamado', {
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
    void qc.invalidateQueries({ queryKey: ['dividends'] });
  }, [isMined, txHash, qc]);

  const handleClaim = () => {
    if (!distributor) return;
    writeContract({
      address: distributor as Address,
      abi: ABI.dividendDistributor,
      functionName: 'claim',
      args: [dividend.dividendId],
      chainId: avalancheFuji.id,
    });
  };

  const isPending = isWaitingWallet || isMining;

  if (dividend.claimed) {
    return (
      <Badge variant="success" size="sm">
        <CheckCircle2 className="h-3 w-3" />
        Reclamado
      </Badge>
    );
  }

  return (
    <Button size="sm" onClick={handleClaim} disabled={isPending || !distributor}>
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          {isMining ? 'Confirmando...' : 'Esperando wallet...'}
        </>
      ) : (
        `Reclamar ${fmtUsdc(dividend.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USDC`
      )}
    </Button>
  );
}

export default function InvestorDividendsPage() {
  const { address, realConnected } = useWallet();
  const { data: claimable, isLoading } = useClaimableDividends(address ?? undefined);

  if (!realConnected) {
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Dividendos' }]}
          title="Mis dividendos"
          description="Reclama los dividendos que el emisor ha declarado para tus participaciones."
        />
        <ConnectWalletPrompt description="Conecta tu wallet para ver los dividendos disponibles para reclamar." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Inversionista', href: '/investor' }, { label: 'Dividendos' }]}
        title="Mis dividendos"
        description="Reclama los dividendos que el emisor ha declarado para tus participaciones."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dividendos disponibles</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="space-y-3 px-6 pb-6">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !claimable || claimable.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                icon={<Coins className="h-6 w-6" />}
                title="No tienes dividendos pendientes"
                description="Los anuncia el emisor cuando hay distribucion de ganancias. Cuando se declaren apareceran aqui automaticamente."
              />
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {claimable.map((d) => (
                <div
                  key={d.dividendId.toString()}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground-tertiary">
                        Dividendo #{d.dividendId.toString()}
                      </span>
                      <Badge variant={d.claimed ? 'success' : 'warning'} size="sm">
                        {d.claimed ? 'Reclamado' : 'Pendiente'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">{offeringLabel(d.token)}</p>
                    <p className="text-xs text-foreground-secondary">
                      Pago en:{' '}
                      <span className="font-mono">
                        {d.paymentToken.slice(0, 6)}...{d.paymentToken.slice(-4)}
                      </span>{' '}
                      (USDC)
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
                        {d.claimed ? 'Recibiste' : 'Por reclamar'}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        <Money value={fmtUsdc(d.amount)} currency="USDC" />
                      </p>
                    </div>
                    <ClaimButton dividend={d} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
