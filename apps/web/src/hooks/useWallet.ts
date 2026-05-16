'use client';

import { useAccount, useDisconnect } from 'wagmi';

/**
 * Wallet state for the connected viewer.
 * Returns `address: null` when no wallet is connected — callers MUST handle that
 * case (no fake mock fallback) so the UI can prompt the user to connect.
 */
export function useWallet() {
  const { address, isConnected, status, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();

  return {
    address: (address ?? null) as `0x${string}` | null,
    realConnected: isConnected,
    isConnected,
    status,
    chainId,
    connector,
    disconnect,
  } as const;
}
