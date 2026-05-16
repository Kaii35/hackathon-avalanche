'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/client/wagmi';

const theme = darkTheme({
  accentColor: '#E84142',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

const appInfo = {
  appName: 'Mercado Secundario IFC',
  learnMoreUrl: 'https://www.avax.network/',
  disclaimer: ({
    Text,
    Link,
  }: {
    Text: React.ComponentType<{ children: ReactNode }>;
    Link: React.ComponentType<{ href: string; children: ReactNode }>;
  }) => (
    <Text>
      Conectarte usa tu wallet para firmar transacciones en Avalanche Fuji (testnet). No almacenamos
      tu llave privada. Lee nuestros <Link href="#">Términos</Link>.
    </Text>
  ),
};

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        appInfo={appInfo}
        theme={theme}
        modalSize="compact"
        locale="es-419"
        initialChain={43113}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
