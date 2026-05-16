import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s · Arca',
    default: 'Arca · Mercado Secundario Regulado',
  },
  description:
    'Arca — mercado secundario regulado de participaciones IFC sobre Avalanche, con compliance CNBV embebido en smart contracts.',
  keywords: ['Arca', 'IFC', 'tokenización', 'CNBV', 'Avalanche', 'mercado secundario', 'ERC-3643'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen bg-canvas text-foreground font-sans antialiased"
        // Browser extensions (Grammarly, LastPass, etc.) inject attributes
        // into <body> before React hydrates → spurious hydration warnings.
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
