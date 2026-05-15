import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IFC Secondary Market — Powered by Avalanche',
  description: 'Mercado secundario regulado de participaciones IFC sobre Avalanche',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
