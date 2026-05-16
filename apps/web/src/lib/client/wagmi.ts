'use client';

import { http, createConfig, fallback, type Config } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';
import { connectorsForWallets, getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  coreWallet,
  metaMaskWallet,
  coinbaseWallet as rkCoinbase,
  injectedWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

const APP_NAME = 'Mercado Secundario IFC';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const HAS_WALLETCONNECT = Boolean(
  projectId && projectId.length >= 8 && projectId !== 'demo-walletconnect-project',
);

function buildConfig(): Config {
  const transports = {
    [avalancheFuji.id]: fallback([http(RPC_URL)]),
  } as const;

  // Avalanche-native first (Core), then general-purpose wallets.
  // WalletConnect (mobile QR) is included only when we have a real projectId.
  const avalancheGroup = {
    groupName: 'Avalanche',
    wallets: [coreWallet],
  };
  const popularWallets = [metaMaskWallet, rkCoinbase, rabbyWallet, rainbowWallet, trustWallet];
  if (HAS_WALLETCONNECT) popularWallets.push(walletConnectWallet);
  const popularGroup = {
    groupName: 'Más opciones',
    wallets: [...popularWallets, injectedWallet],
  };

  // Full RainbowKit experience with WalletConnect when projectId is provided.
  if (HAS_WALLETCONNECT) {
    return getDefaultConfig({
      appName: APP_NAME,
      projectId: projectId as string,
      chains: [avalancheFuji],
      transports,
      // ssr: false keeps wagmi client-side only with localStorage persistence.
      // Avoids the SSR cookie-rehydration dance that was disconnecting users.
      ssr: false,
      wallets: [avalancheGroup, popularGroup],
    });
  }

  // Fallback: build connectors manually with a placeholder projectId so libs
  // that read it during init don't throw, but skip the WalletConnect connector.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(
      '[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set — WalletConnect (mobile QR) is disabled. Browser-extension wallets work normally. Get a free projectId at https://cloud.reown.com.',
    );
  }
  const connectors = connectorsForWallets([avalancheGroup, popularGroup], {
    appName: APP_NAME,
    projectId: 'fallback-no-wc',
  });

  return createConfig({
    chains: [avalancheFuji],
    transports,
    connectors,
    // ssr: false → wagmi runs client-side only with localStorage persistence.
    // Trade-off: brief flash of "disconnected" on first render before wagmi
    // hydrates from localStorage. Acceptable for dev/demo; simpler than the
    // cookie-rehydration SSR dance.
    ssr: false,
  });
}

export const wagmiConfig: Config = buildConfig();

// Re-exports + helpers
export { avalancheFuji };
export const SNOWTRACE_BASE = 'https://testnet.snowtrace.io';
export const explorerAddress = (addr: string) => `${SNOWTRACE_BASE}/address/${addr}`;
export const explorerTx = (hash: string) => `${SNOWTRACE_BASE}/tx/${hash}`;

// Suppress unused-import lints for connectors brought in case getDefaultConfig path changes.
void coinbaseWallet;
void injected;
void metaMask;
