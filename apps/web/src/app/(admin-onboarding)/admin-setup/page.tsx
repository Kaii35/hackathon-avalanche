'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  WalletAddress,
} from '@hack/ui';
import { SIWE_DOMAIN } from '@hack/shared';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY, useSession } from '@/lib/client/queries/session';

function buildSiweMessage(address: string): string {
  return [
    `${SIWE_DOMAIN} quiere vincular tu wallet (admin):`,
    '',
    address,
    '',
    'URI: https://arca.mx',
    'Versión: 1',
    'Chain ID: 43113',
    `Issued At: ${new Date().toISOString()}`,
    '',
    'Esta firma vincula tu wallet a tu cuenta admin. No autoriza ninguna transferencia.',
  ].join('\n');
}

/**
 * Standalone admin post-register screen. Reached only when an admin has just
 * registered and still needs to link a wallet to sign on-chain compliance
 * actions (freeze, whitelist, forced transfer). No Sumsub, no personal-data
 * step — admins are pre-vetted off-platform.
 */
export default function AdminSetupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useSession();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Defensive guards: this page is for freshly-registered admins only.
  // - Non-admin → bounce to their own onboarding/dashboard.
  // - Admin who already has a primaryWallet → straight into the panel.
  useEffect(() => {
    if (sessionLoading || !mounted) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.role !== 'admin') {
      router.replace('/onboarding');
      return;
    }
    if (session.primaryWallet) {
      router.replace('/admin');
    }
  }, [session, sessionLoading, mounted, router]);

  const linked = Boolean(session?.primaryWallet);
  const effectiveAddress = address ?? session?.primaryWallet ?? null;

  const linkWallet = async () => {
    if (!effectiveAddress) return;
    setSigning(true);
    try {
      const message = buildSiweMessage(effectiveAddress);
      const signature = await signMessageAsync({ message });
      await api.call('/api/users/me/wallet', {
        method: 'POST',
        body: { address: effectiveAddress, message, signature },
      });
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success('Wallet vinculada — bienvenido al panel admin');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/rejected|denied|user rejected/i.test(msg)) {
        toast.info('Firma cancelada en tu wallet');
      } else if (e instanceof ApiError) {
        const payload = e.payload as { error?: { message?: string } } | undefined;
        toast.error(payload?.error?.message ?? `No pudimos vincular (${e.status})`);
      } else {
        toast.error(msg || 'No pudimos vincular la wallet');
      }
    } finally {
      setSigning(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand/10 ring-1 ring-brand/30">
          <ShieldCheck className="h-6 w-6 text-brand" />
        </div>
        <CardTitle className="text-2xl">Cuenta admin lista</CardTitle>
        <CardDescription className="mx-auto max-w-md">
          Solo falta vincular una wallet para que puedas firmar acciones de compliance on-chain
          (congelar wallets, whitelisting, transferencias forzadas). Esta firma{' '}
          <strong>no autoriza ninguna transferencia</strong>.
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
                <p className="text-sm font-medium">Wallet</p>
                {mounted && (isConnected || linked) && effectiveAddress ? (
                  <WalletAddress address={effectiveAddress} className="mt-1" />
                ) : (
                  <p className="mt-0.5 text-xs text-foreground-tertiary">
                    Conecta MetaMask, Core, Rabby, Coinbase o WalletConnect.
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

        {linked ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success-fg">
            <CheckCircle2 className="h-4 w-4" />
            Wallet vinculada a tu cuenta admin
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-xs text-foreground-secondary">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
            <span>
              Tu wallet se guardará vinculada a tu user admin. Necesitarás AVAX en Fuji para enviar
              transacciones reales (freeze, whitelist, etc).
            </span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {linked ? (
            <Button size="lg" onClick={() => router.push('/admin')}>
              Ir al panel admin
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="lg" onClick={() => router.push('/admin')}>
                Más tarde
              </Button>
              <Button
                size="lg"
                onClick={linkWallet}
                disabled={signing || !effectiveAddress}
                loading={signing}
              >
                {signing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Firmando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Firmar y vincular
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-2xs text-foreground-tertiary">
          {session?.email && (
            <>
              Cuenta: <span className="font-mono">{session.email}</span> ·{' '}
              <Badge variant="outline" size="sm">
                admin
              </Badge>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
