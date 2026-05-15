'use client';

import { http, createConfig, fallback } from 'wagmi';
import { avalancheFuji } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo-walletconnect-project';

export const wagmiConfig = getDefaultConfig({
  appName: 'Mercado Secundario IFC',
  projectId,
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: fallback([http('https://api.avax-test.network/ext/bc/C/rpc')]),
  },
  ssr: true,
});

// Helpers re-export
export { avalancheFuji };
export const SNOWTRACE_BASE = 'https://testnet.snowtrace.io';
export const explorerAddress = (addr: string) => `${SNOWTRACE_BASE}/address/${addr}`;
export const explorerTx = (hash: string) => `${SNOWTRACE_BASE}/tx/${hash}`;

// dummy export to keep wagmi happy in unused config flag
export const _wagmiPlaceholder = createConfig;
