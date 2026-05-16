'use client';

import { useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { maxUint256, type Address } from 'viem';
import { avalancheFuji } from 'wagmi/chains';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@hack/ui';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { toast } from 'sonner';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;

export interface ApproveDividendDistributorButtonProps {
  /** Required USDC amount in base units; compared against current allowance. */
  requiredAmount: bigint;
  /** Called after the allowance refetch confirms sufficiency. */
  onApproved?: () => void;
}

/**
 * Checks USDC allowance for the DividendDistributor contract.
 * If allowance < requiredAmount, renders an approve button.
 * Renders nothing once allowance is sufficient.
 */
export function ApproveDividendDistributorButton({
  requiredAmount,
  onApproved,
}: ApproveDividendDistributorButtonProps) {
  const { address: owner } = useAccount();
  const distributorAddress = CONTRACT_ADDRESSES.dividendDistributor;
  const usdcAddress = CONTRACT_ADDRESSES.usdc;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress ?? undefined,
    abi: ABI.erc20Approve,
    functionName: 'allowance',
    args: owner && distributorAddress ? [owner, distributorAddress as Address] : undefined,
    chainId: avalancheFuji.id,
    query: {
      enabled: Boolean(owner && distributorAddress && usdcAddress),
      refetchInterval: 8_000,
    },
  });

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();

  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Aprobacion confirmada', {
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
    void refetchAllowance();
    onApproved?.();
  }, [isMined, txHash, refetchAllowance, onApproved]);

  if (!distributorAddress || !usdcAddress) return null;

  const currentAllowance = typeof allowance === 'bigint' ? allowance : 0n;
  if (currentAllowance >= requiredAmount && requiredAmount > 0n) return null;

  const handleApprove = () => {
    writeContract({
      address: usdcAddress as Address,
      abi: ABI.erc20Approve,
      functionName: 'approve',
      args: [distributorAddress as Address, maxUint256],
      chainId: avalancheFuji.id,
    });
  };

  const isPending = isWaitingWallet || isMining;

  return (
    <Button
      variant="outline"
      size="md"
      className="w-full"
      onClick={handleApprove}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Loader2 className="animate-spin" />
          {isMining ? 'Confirmando en red...' : 'Esperando wallet...'}
        </>
      ) : isMined ? (
        <>
          <CheckCircle2 className="text-success-fg" />
          Aprobado
        </>
      ) : (
        'Aprobar DividendDistributor (USDC)'
      )}
    </Button>
  );
}
