'use client';

import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Wallet } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@hack/ui';
import { SIWE_DOMAIN } from '@hack/shared';
import { useSession, SESSION_KEY } from '@/lib/client/queries/session';
import { useUiStore } from '@/lib/client/stores/uiStore';
import { api, ApiError } from '@/lib/client/api';

/**
 * Wallet welcome modal — appears ONCE for freshly registered users on first
 * dashboard load, gated by a sessionStorage flag set by the register page.
 * Existing users never see it on dashboard load; they only see the
 * "Conectar wallet" button in the Topbar (which goes direct to RainbowKit).
 *
 * Once wagmi is connected and the user still has no primaryWallet in DB,
 * the modal offers a SIWE link step. If they dismiss, the flag prevents
 * it from popping again this session.
 *
 * Admins are skipped (don't need a wallet for compliance ops).
 * Auto-closes once session.primaryWallet appears.
 */

const WELCOME_KEY = 'wallet-welcome-pending';
const DISMISS_LINK_KEY = 'wallet-prompt-dismissed-link-v1';

function buildSiweMessage(address: string): string {
  return [
    `${SIWE_DOMAIN} quiere vincular tu wallet:`,
    '',
    address,
    '',
    'URI: https://arca.mx',
    'Versión: 1',
    'Chain ID: 43113',
    `Issued At: ${new Date().toISOString()}`,
    '',
    'Esta firma no autoriza ninguna transferencia.',
  ].join('\n');
}

export function ConnectWalletDialog() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const manualOpen = useUiStore((s) => s.walletDialogOpen);
  const setManualOpen = useUiStore((s) => s.setWalletDialogOpen);
  const [mounted, setMounted] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => setMounted(true), []);

  const open = autoOpen || manualOpen;

  // Auto-open ONLY on welcome flow (freshly registered users) OR when the user
  // has just connected wagmi but still has no DB link (offer SIWE link step).
  // Existing logins don't get any auto-popup — they use the Topbar button.
  useEffect(() => {
    if (!mounted) return;
    if (!session) return;
    if (session.role === 'admin') return;
    if (session.primaryWallet) return;
    if (typeof window === 'undefined') return;

    // Case 1: welcome flow — set by /register on first dashboard hit
    const welcome = window.sessionStorage.getItem(WELCOME_KEY);
    if (welcome) {
      window.sessionStorage.removeItem(WELCOME_KEY); // consume one-shot
      const t = window.setTimeout(() => setAutoOpen(true), 700);
      return () => window.clearTimeout(t);
    }

    // Case 2: user connected via Topbar but hasn't linked → offer SIWE.
    // Respects per-session dismiss to avoid nagging.
    if (isConnected && !window.sessionStorage.getItem(DISMISS_LINK_KEY)) {
      const t = window.setTimeout(() => setAutoOpen(true), 500);
      return () => window.clearTimeout(t);
    }
  }, [mounted, session, isConnected]);

  // Derive the current step from wagmi + session state.
  // 'connect'     : wagmi not connected — needs to connect (may also need to link after)
  // 'link'        : wagmi connected, primaryWallet not set — needs to sign SIWE
  // 'reconnected' : wagmi connected, primaryWallet already set — all good, can auto-close
  const stepValue: 'connect' | 'link' | 'reconnected' =
    !isConnected || !address ? 'connect' : !session?.primaryWallet ? 'link' : 'reconnected';

  // Auto-close 1.5s after we land on 'reconnected' (gives the user a moment
  // to see the success state). Doesn't fire if dialog isn't open.
  useEffect(() => {
    if (stepValue !== 'reconnected' || !open) return;
    const t = window.setTimeout(() => {
      setAutoOpen(false);
      setManualOpen(false);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [stepValue, open, setManualOpen]);

  const dismiss = () => {
    // Only the LINK step uses a dismiss flag (so we don't ask twice in one
    // session). The welcome step is one-shot already via WELCOME_KEY consume.
    if (typeof window !== 'undefined' && isConnected) {
      window.sessionStorage.setItem(DISMISS_LINK_KEY, '1');
    }
    setAutoOpen(false);
    setManualOpen(false);
  };

  const linkWallet = async () => {
    if (!address) return;
    setLinking(true);
    try {
      const message = buildSiweMessage(address);
      const signature = await signMessageAsync({ message });
      await api.call('/api/users/me/wallet', {
        method: 'POST',
        body: { address, message, signature },
      });
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success('Wallet vinculada a tu cuenta');
      // The session invalidation refetches → primaryWallet is set →
      // the auto-close effect above runs.
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
      setLinking(false);
    }
  };

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setManualOpen(true);
        } else {
          dismiss();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-brand/10 ring-1 ring-brand/30">
            <Wallet className="size-5 text-brand" />
          </div>
          <DialogTitle className="text-center">
            {stepValue === 'connect'
              ? 'Conecta tu wallet'
              : stepValue === 'link'
                ? 'Vincula tu wallet'
                : '¡Wallet conectada!'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {stepValue === 'connect' ? (
              <>
                Para operar (recibir tokens, firmar trades, ver portfolio) necesitas una wallet.
                Soportamos Core, MetaMask, Rabby, Coinbase y WalletConnect.
              </>
            ) : stepValue === 'link' ? (
              <>
                Conectaste <span className="font-mono text-foreground">{shortAddress}</span>. Firma
                un mensaje breve para vincular esta wallet a tu cuenta.
              </>
            ) : (
              <>
                <span className="font-mono text-foreground">{shortAddress}</span> ya está vinculada
                a tu cuenta. Cerrando…
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-2">
          {stepValue === 'connect' && (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted: rkMounted }) => (
                <Button
                  onClick={() => {
                    // Close THIS dialog first, then open RainbowKit. Otherwise
                    // Radix's overlay sits above RainbowKit and eats clicks
                    // on wallet items.
                    setAutoOpen(false);
                    setManualOpen(false);
                    // Defer so the dialog has a tick to unmount before
                    // RainbowKit's portal mounts on top.
                    window.setTimeout(() => openConnectModal(), 50);
                  }}
                  disabled={!rkMounted}
                  className="w-full"
                  size="lg"
                >
                  <Wallet className="size-4" />
                  Conectar wallet
                </Button>
              )}
            </ConnectButton.Custom>
          )}
          {stepValue === 'link' && (
            <Button onClick={linkWallet} disabled={linking} className="w-full" size="lg">
              {linking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Firmando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Vincular wallet
                </>
              )}
            </Button>
          )}
          {stepValue === 'reconnected' && (
            <div className="flex items-center justify-center gap-2 rounded-full bg-success-bg px-4 py-3 text-sm text-success-fg">
              <CheckCircle2 className="size-4" />
              Todo en orden
            </div>
          )}
          {stepValue !== 'reconnected' && (
            <Button variant="ghost" onClick={dismiss} className="w-full" disabled={linking}>
              Más tarde
            </Button>
          )}
        </div>

        <p className="mt-2 text-center text-2xs text-foreground-tertiary">
          La firma SIWE es solo para vincular tu wallet a tu cuenta — no autoriza ninguna
          transferencia.
        </p>
      </DialogContent>
    </Dialog>
  );
}
