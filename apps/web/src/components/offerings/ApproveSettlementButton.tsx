'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { maxUint256, type Address } from 'viem';
import { avalancheFuji } from 'wagmi/chains';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@hack/ui';
import { ABI, CONTRACT_ADDRESSES } from '@/lib/client/contracts';
import { toast } from 'sonner';
import { useEffect } from 'react';

const SNOWSCAN_TX = (hash: string) => `https://testnet.snowscan.xyz/tx/${hash}`;

export interface ApproveSettlementButtonProps {
  side: 'buy' | 'sell';
  /** SecurityToken address — used when side === 'sell' */
  tokenAddress: Address;
  /** USDC address — used when side === 'buy'. Defaults to NEXT_PUBLIC_USDC. */
  paymentToken?: Address;
  /** Required amount in base units; compared against current allowance. */
  requiredAmount: bigint;
  /** Short symbol used to label the button ("ARKDEMO" / "USDC"). */
  symbol: string;
  /** Called after the allowance refetch confirms sufficiency. */
  onApproved?: () => void;
}

export function ApproveSettlementButton({
  side,
  tokenAddress,
  paymentToken,
  requiredAmount,
  symbol,
  onApproved,
}: ApproveSettlementButtonProps) {
  const { address: owner } = useAccount();
  const settlementAddress = CONTRACT_ADDRESSES.settlement;
  // The token to approve is USDC when buying, SecurityToken when selling
  const spendToken =
    side === 'buy' ? (paymentToken ?? CONTRACT_ADDRESSES.usdc ?? tokenAddress) : tokenAddress;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: spendToken,
    abi: ABI.erc20Approve,
    functionName: 'allowance',
    args: owner && settlementAddress ? [owner, settlementAddress] : undefined,
    chainId: avalancheFuji.id,
    query: {
      enabled: Boolean(owner && settlementAddress && spendToken),
      refetchInterval: 8000,
    },
  });

  const { data: txHash, writeContract, isPending: isWaitingWallet } = useWriteContract();

  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: avalancheFuji.id,
  });

  // After mining, refetch allowance and notify parent
  useEffect(() => {
    if (!isMined || !txHash) return;
    toast.success('Aprobación confirmada', {
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

  if (!settlementAddress) return null;

  const currentAllowance = typeof allowance === 'bigint' ? allowance : 0n;
  if (currentAllowance >= requiredAmount) return null;

  const handleApprove = () => {
    writeContract({
      address: spendToken,
      abi: ABI.erc20Approve,
      functionName: 'approve',
      args: [settlementAddress, maxUint256],
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
          {isMining ? 'Confirmando en red…' : 'Esperando wallet…'}
        </>
      ) : isMined ? (
        <>
          <CheckCircle2 className="text-success-fg" />
          Aprobado
        </>
      ) : (
        `Aprobar Settlement (${symbol})`
      )}
    </Button>
  );
}
