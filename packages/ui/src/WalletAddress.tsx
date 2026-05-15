'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { cn } from './lib/cn';

export interface WalletAddressProps {
  address: string;
  truncate?: boolean;
  copyable?: boolean;
  explorerUrl?: string;
  explorerBase?: string;
  className?: string;
  size?: 'sm' | 'md';
}

function trunc(addr: string, head = 6, tail = 4) {
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function WalletAddress({
  address,
  truncate = true,
  copyable = true,
  explorerUrl,
  explorerBase = 'https://testnet.snowtrace.io/address/',
  className,
  size = 'md',
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const display = truncate ? trunc(address) : address;
  const link = explorerUrl ?? `${explorerBase}${address}`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-mono',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      <span className="text-foreground-secondary">{display}</span>
      {copyable && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copiado' : 'Copiar dirección'}
          className="rounded p-0.5 text-foreground-tertiary transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          {copied ? <Check className="h-3 w-3 text-success-fg" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      {explorerBase && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-0.5 text-foreground-tertiary transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Ver en explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
