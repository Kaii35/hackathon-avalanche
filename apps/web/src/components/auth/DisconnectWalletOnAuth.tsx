'use client';

import { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

/**
 * Client-side effect that disconnects any leftover wagmi connection while the
 * user is on an auth page (login/register). Prevents the surprising state of
 * "wallet conectada pero sin sesión": the wallet should only be connectable
 * once authenticated.
 */
export function DisconnectWalletOnAuth() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isConnected) disconnect();
  }, [isConnected, disconnect]);

  return null;
}
