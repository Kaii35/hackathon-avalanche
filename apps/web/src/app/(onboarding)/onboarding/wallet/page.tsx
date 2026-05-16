'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { toast } from 'sonner';
import { SIWE_DOMAIN } from '@hack/shared';
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
import { api, ApiError } from '@/lib/client/api';

/**
 * Build the exact SIWE-like message the backend validates.
 * Must include SIWE_DOMAIN + the wallet address + a freshly minted Issued At
 * timestamp (the server rejects messages older than 10 minutes).
 */
function buildSiweMessage(address: string): string {
  return [
    `${SIWE_DOMAIN} quiere vincular tu wallet:`,
    '',
    address,
    '',
    'URI: https://mercado-ifc.app',
    'Versión: 1',
    'Chain ID: 43113',
    `Issued At: ${new Date().toISOString()}`,
    '',
    'Esta firma no autoriza ninguna transferencia.',
  ].join('\n');
}

export default function WalletPage() {
  const router = useRouter();
  const { walletConnected, walletAddress, patch } = useOnboardingStore();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);

  // Mounted gate so the SIWE preview (which interpolates a live timestamp
  // and the wagmi address) doesn't cause a SSR/CSR hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effectiveAddress = (address ?? walletAddress ?? null) as `0x${string}` | null;
  const linked = walletConnected;

  const linkWallet = async () => {
    if (!effectiveAddress) return;
    setSigning(true);
    try {
      // Build the message fresh at click-time so its Issued At timestamp is
      // close to the server's clock (server allows ≤10 min skew).
      const message = buildSiweMessage(effectiveAddress);
      // Ask the wallet to sign. This pops the wallet's confirmation UI.
      const signature = await signMessageAsync({ message });
      // Server verifies the signature, recovers address, and persists the link.
      await api.call('/api/users/me/wallet', {
        method: 'POST',
        body: { address: effectiveAddress, message, signature },
      });
      patch({ walletConnected: true, walletAddress: effectiveAddress });
      toast.success('Wallet vinculada a tu cuenta');
    } catch (e) {
      // User cancelling the wallet prompt → friendly info, not an error.
      const msg = e instanceof Error ? e.message : String(e);
      if (/rejected|denied|user rejected/i.test(msg)) {
        toast.info('Firma cancelada en tu wallet');
      } else if (e instanceof ApiError) {
        const payload = e.payload as { error?: { message?: string } } | undefined;
        toast.error(payload?.error?.message ?? `No pudimos vincular la wallet (${e.status})`);
      } else {
        toast.error(msg || 'No pudimos vincular la wallet');
      }
    } finally {
      setSigning(false);
    }
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
                {/* Gate on `mounted` — wagmi's isConnected and the zustand
                    walletAddress are both client-only state, so rendering
                    them before mount produces a different tag than the
                    server emitted (<span> vs <p>) → hydration mismatch. */}
                {mounted && (isConnected || walletConnected) && effectiveAddress ? (
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
          <pre
            // suppressHydrationWarning is a safety net; the `mounted` gate
            // already makes server and client emit the same text on the
            // initial render.
            suppressHydrationWarning
            className="mt-2 whitespace-pre-wrap rounded-md border border-border-subtle bg-canvas p-3 font-mono text-xs text-foreground-secondary"
          >
            {mounted
              ? buildSiweMessage(effectiveAddress ?? '<conecta tu wallet>')
              : 'Conecta tu wallet para ver el mensaje SIWE…'}
          </pre>
          <div className="mt-4 flex items-center justify-between gap-3">
            {linked ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" />
                Wallet vinculada a tu cuenta
              </Badge>
            ) : (
              <p className="text-xs text-foreground-tertiary">
                Tu wallet se guardará vinculada a tu user. Si tu KYC ya está aprobado, se registrará
                on-chain en{' '}
                <code className="font-mono text-foreground-secondary">IdentityRegistry</code>.
              </p>
            )}
            <Button
              onClick={linkWallet}
              disabled={linked || signing || !effectiveAddress}
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
