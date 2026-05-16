'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@hack/ui';
import { ShieldCheck, ShieldAlert, Coins, ExternalLink } from 'lucide-react';
import { useKycStatus } from '@/hooks/useKycStatus';
import { useTokenHolding } from '@/hooks/useTokenHolding';
import { CONTRACT_ADDRESSES, FUJI_DEMO_TOKEN } from '@/lib/client/contracts';
import { explorerAddress } from '@/lib/client/wagmi';

interface Props {
  address: `0x${string}`;
}

/**
 * Muestra el estado on-chain del inversor conectado:
 * - KYC verificado en IdentityRegistry
 * - Balance de USDC del demo
 * - Balance de ARKDEMO (demo SecurityToken)
 *
 * Solo se monta cuando hay wallet conectada (el padre valida eso).
 */
export function OnChainStatusCard({ address }: Props) {
  const kyc = useKycStatus(address);
  const usdc = useTokenHolding(CONTRACT_ADDRESSES.usdc, address);
  const arkdemo = useTokenHolding(FUJI_DEMO_TOKEN, address);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Estado on-chain · Fuji</CardTitle>
          <a
            href={explorerAddress(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-foreground-tertiary transition-colors hover:text-foreground-secondary"
          >
            Snowtrace
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* KYC status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground-secondary">
            {kyc.verified ? (
              <ShieldCheck className="h-4 w-4 text-success-fg" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-foreground-tertiary" />
            )}
            <span>Verificación KYC</span>
          </div>
          {kyc.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : kyc.verified === true ? (
            <Badge variant="success">Verificado</Badge>
          ) : kyc.verified === false ? (
            <Badge variant="warning">Pendiente</Badge>
          ) : (
            <Badge variant="outline">—</Badge>
          )}
        </div>

        <div className="border-t border-border-subtle" />

        {/* USDC balance row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground-secondary">
            <Coins className="h-4 w-4 text-foreground-tertiary" />
            <span>{usdc.symbol ?? 'USDC'}</span>
          </div>
          {usdc.isLoading ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span className="font-mono text-sm tabular-nums text-foreground">
              {usdc.formatted ?? '—'}
            </span>
          )}
        </div>

        {/* ARKDEMO balance row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground-secondary">
            <Coins className="h-4 w-4 text-foreground-tertiary" />
            <a
              href={explorerAddress(FUJI_DEMO_TOKEN)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              {arkdemo.symbol ?? 'ARKDEMO'}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {arkdemo.isLoading ? (
            <Skeleton className="h-5 w-28" />
          ) : (
            <span className="font-mono text-sm tabular-nums text-foreground">
              {arkdemo.formatted ?? '—'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
