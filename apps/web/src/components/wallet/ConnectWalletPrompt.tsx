'use client';

import { Button, Card, CardContent } from '@hack/ui';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const WALLET_ICONS = [
  { name: 'Core', color: 'from-brand-500 to-brand-700' },
  { name: 'MetaMask', color: 'from-amber-500 to-amber-700' },
  { name: 'Coinbase', color: 'from-blue-500 to-blue-700' },
  { name: 'Rabby', color: 'from-violet-500 to-violet-700' },
];

export function ConnectWalletPrompt({
  title = 'Conecta tu wallet',
  description,
  size = 'md',
}: Props) {
  const padding = size === 'sm' ? 'py-8' : size === 'lg' ? 'py-16' : 'py-12';
  const iconSize = size === 'sm' ? 'h-12 w-12' : size === 'lg' ? 'h-16 w-16' : 'h-14 w-14';
  const titleSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  const finalDescription =
    description ??
    'Tus balances, posiciones y trades sólo se muestran después de conectar una wallet. No usamos datos de demostración una vez logueado.';

  return (
    <Card className="border-dashed">
      <CardContent className={`flex flex-col items-center gap-4 text-center ${padding}`}>
        <div
          className={`grid place-items-center rounded-full bg-elevated ring-1 ring-border-subtle ${iconSize}`}
        >
          <Wallet className="h-1/2 w-1/2 text-foreground-tertiary" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h2 className={`font-semibold tracking-tight ${titleSize}`}>{title}</h2>
          <p className="text-sm text-foreground-secondary">{finalDescription}</p>
        </div>
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <Button
              onClick={openConnectModal}
              disabled={!mounted}
              size={size === 'sm' ? 'md' : 'lg'}
            >
              <Wallet className="h-4 w-4" />
              Conectar wallet
            </Button>
          )}
        </ConnectButton.Custom>
        <div className="mt-1 flex items-center gap-2">
          {WALLET_ICONS.map((w) => (
            <div
              key={w.name}
              title={w.name}
              className={`grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br ${w.color} text-2xs font-semibold text-white shadow`}
              aria-label={w.name}
            >
              {w.name[0]}
            </div>
          ))}
          <span className="ml-1 text-2xs text-foreground-tertiary">+ WalletConnect</span>
        </div>
      </CardContent>
    </Card>
  );
}
