'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  WalletAddress,
} from '@hack/ui';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';
import { useAccount } from 'wagmi';

export default function WalletPage() {
  const router = useRouter();
  const { walletConnected, walletAddress, patch } = useOnboardingStore();
  const { address, isConnected } = useAccount();
  const [signing, setSigning] = useState(false);

  const effectiveAddress = (address ?? walletAddress ?? null) as `0x${string}` | null;
  const linked = walletConnected;

  const simulateLink = async () => {
    if (!effectiveAddress) return;
    setSigning(true);
    await new Promise((r) => setTimeout(r, 1300));
    patch({ walletConnected: true, walletAddress: effectiveAddress });
    setSigning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vincula tu wallet</CardTitle>
        <CardDescription>
          Vamos a registrar tu wallet en IdentityRegistry tras una firma SIWE. Esta firma no
          autoriza ninguna transferencia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-border-subtle bg-elevated/40 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-brand-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Wallet detectada</p>
                {(isConnected || walletConnected) && effectiveAddress ? (
                  <WalletAddress address={effectiveAddress} className="mt-1" />
                ) : (
                  <p className="mt-0.5 text-xs text-foreground-tertiary">
                    Conecta MetaMask, Rabby, Coinbase Wallet o WalletConnect.
                  </p>
                )}
              </div>
            </div>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-5">
          <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
            Mensaje SIWE
          </p>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border-subtle bg-canvas p-3 font-mono text-xs text-foreground-secondary">
            {`mercado-ifc.local quiere vincular tu wallet:

${effectiveAddress}

URI: https://mercado-ifc.app
Versión: 1
Chain ID: 43113
Issued At: ${new Date().toISOString()}

Esta firma no autoriza ninguna transferencia.`}
          </pre>
          <div className="mt-4 flex items-center justify-between gap-3">
            {linked ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" />
                Wallet vinculada y registrada en IdentityRegistry
              </Badge>
            ) : (
              <p className="text-xs text-foreground-tertiary">
                Tras la firma se ejecutará{' '}
                <code className="font-mono text-foreground-secondary">
                  IdentityRegistry.registerIdentity()
                </code>
              </p>
            )}
            <Button
              onClick={simulateLink}
              disabled={linked || signing}
              variant={linked ? 'secondary' : 'primary'}
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Firmando…
                </>
              ) : linked ? (
                'Vinculada'
              ) : (
                'Firmar y vincular'
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-xs text-foreground-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
          Necesitas tener AVAX en Fuji para firmar transacciones reales. En este demo todo es
          simulado — no necesitas gas.
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" onClick={() => router.push('/onboarding/kyc')}>
          <ChevronLeft />
          Volver
        </Button>
        <Button
          disabled={!linked}
          onClick={() => {
            patch({ step: 3 });
            router.push('/onboarding/complete');
          }}
        >
          Continuar
          <ChevronRight />
        </Button>
      </CardFooter>
    </Card>
  );
}
