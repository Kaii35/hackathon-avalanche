'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/client/wagmi';

const ARKANGELES_BLUE = '#2A5BFF';

const dark = darkTheme({
  accentColor: ARKANGELES_BLUE,
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

const light = lightTheme({
  accentColor: ARKANGELES_BLUE,
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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Until next-themes hydrates we default to dark to avoid a flash; afterwards
  // RainbowKit follows the user's chosen theme.
  const rkTheme = mounted && resolvedTheme === 'light' ? light : dark;

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        appInfo={appInfo}
        theme={rkTheme}
        modalSize="compact"
        locale="es-419"
        initialChain={43113}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
