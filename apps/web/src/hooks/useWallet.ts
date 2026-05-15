'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';
import { MOCK_WALLET } from '@/lib/client/mocks/portfolio';

/**
 * Combined wallet hook: prefers wagmi connection, falls back to onboarding mock wallet.
 */
export function useWallet() {
  const { address, isConnected, status, chainId, connector } = useAccount();
  const { walletConnected, walletAddress } = useOnboardingStore();
  const { disconnect } = useDisconnect();

  const effectiveAddress = (address ??
    (walletConnected ? walletAddress : null) ??
    MOCK_WALLET) as `0x${string}`;
  const isReady = isConnected || walletConnected || true; // mock-ready

  return {
    address: effectiveAddress,
    realConnected: isConnected,
    isConnected: isReady,
    status,
    chainId,
    connector,
    disconnect,
  } as const;
}
