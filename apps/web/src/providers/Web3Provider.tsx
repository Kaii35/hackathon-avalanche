'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme, type Theme } from '@rainbow-me/rainbowkit';
import { useTheme } from 'next-themes';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '@/lib/client/wagmi';

const ARKANGELES_BLUE = '#2A5BFF';

const baseDark = darkTheme({
  accentColor: ARKANGELES_BLUE,
  accentColorForeground: '#ffffff',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'large',
});

const dark: Theme = {
  ...baseDark,
  colors: {
    ...baseDark.colors,
    modalBackground: '#0B0F1A',
    modalBackdrop: 'rgba(3, 6, 14, 0.72)',
    modalBorder: 'rgba(255, 255, 255, 0.06)',
    modalText: 'hsl(0 0% 98%)',
    modalTextDim: 'hsl(220 6% 60%)',
    modalTextSecondary: 'hsl(220 8% 72%)',
    menuItemBackground: 'rgba(255, 255, 255, 0.03)',
    actionButtonBorder: 'rgba(255, 255, 255, 0.08)',
    actionButtonBorderMobile: 'rgba(255, 255, 255, 0.08)',
    actionButtonSecondaryBackground: 'rgba(255, 255, 255, 0.05)',
    closeButton: 'hsl(220 8% 78%)',
    closeButtonBackground: 'rgba(255, 255, 255, 0.06)',
    generalBorder: 'rgba(255, 255, 255, 0.06)',
    generalBorderDim: 'rgba(255, 255, 255, 0.04)',
    profileAction: 'rgba(255, 255, 255, 0.05)',
    profileActionHover: 'rgba(255, 255, 255, 0.08)',
    selectedOptionBorder: ARKANGELES_BLUE,
  },
  radii: {
    ...baseDark.radii,
    modal: '20px',
    modalMobile: '20px',
    actionButton: '12px',
    menuButton: '14px',
  },
  shadows: {
    ...baseDark.shadows,
    dialog:
      '0 0 0 1px rgba(42, 91, 255, 0.16), 0 32px 64px -16px rgba(0, 0, 0, 0.6), 0 0 80px -20px rgba(42, 91, 255, 0.45)',
    selectedWallet: '0 0 0 1px rgba(42, 91, 255, 0.6), 0 8px 24px -8px rgba(42, 91, 255, 0.4)',
    selectedOption: '0 0 0 1px rgba(42, 91, 255, 0.45)',
    walletLogo: '0 2px 8px rgba(0, 0, 0, 0.4)',
    profileDetailsAction: '0 2px 6px rgba(0, 0, 0, 0.3)',
    connectButton: '0 4px 14px rgba(0, 0, 0, 0.18)',
  },
};

const baseLight = lightTheme({
  accentColor: ARKANGELES_BLUE,
  accentColorForeground: '#ffffff',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'large',
});

const light: Theme = {
  ...baseLight,
  colors: {
    ...baseLight.colors,
    modalBackground: '#FFFFFF',
    modalBackdrop: 'rgba(15, 23, 42, 0.32)',
    modalBorder: 'rgba(15, 23, 42, 0.06)',
    modalText: 'hsl(222 30% 10%)',
    modalTextDim: 'hsl(220 8% 48%)',
    modalTextSecondary: 'hsl(220 12% 32%)',
    menuItemBackground: 'rgba(15, 23, 42, 0.025)',
    actionButtonBorder: 'rgba(15, 23, 42, 0.08)',
    actionButtonBorderMobile: 'rgba(15, 23, 42, 0.08)',
    actionButtonSecondaryBackground: 'rgba(15, 23, 42, 0.04)',
    closeButton: 'hsl(220 12% 32%)',
    closeButtonBackground: 'rgba(15, 23, 42, 0.05)',
    generalBorder: 'rgba(15, 23, 42, 0.06)',
    generalBorderDim: 'rgba(15, 23, 42, 0.04)',
    profileAction: 'rgba(15, 23, 42, 0.04)',
    profileActionHover: 'rgba(15, 23, 42, 0.07)',
    selectedOptionBorder: ARKANGELES_BLUE,
  },
  radii: {
    ...baseLight.radii,
    modal: '20px',
    modalMobile: '20px',
    actionButton: '12px',
    menuButton: '14px',
  },
  shadows: {
    ...baseLight.shadows,
    dialog:
      '0 0 0 1px rgba(42, 91, 255, 0.12), 0 32px 64px -16px rgba(15, 23, 42, 0.22), 0 0 80px -20px rgba(42, 91, 255, 0.32)',
    selectedWallet: '0 0 0 1px rgba(42, 91, 255, 0.5), 0 8px 24px -8px rgba(42, 91, 255, 0.3)',
    selectedOption: '0 0 0 1px rgba(42, 91, 255, 0.4)',
    walletLogo: '0 2px 8px rgba(15, 23, 42, 0.18)',
    profileDetailsAction: '0 2px 6px rgba(15, 23, 42, 0.12)',
    connectButton: '0 4px 14px rgba(15, 23, 42, 0.08)',
  },
};

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
