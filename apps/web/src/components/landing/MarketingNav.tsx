'use client';

import Link from 'next/link';
import { Button } from '@hack/ui';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArrowRight, Wallet } from 'lucide-react';
import { useSession } from '@/lib/client/queries/session';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { Logo } from '@/components/brand/Logo';
import type { SessionUser } from '@hack/shared';

function dashboardFor(role: SessionUser['role']): string {
  if (role === 'admin') return '/admin';
  if (role === 'issuer') return '/issuer';
  return '/investor';
}

export function MarketingNav() {
  const { data: session } = useSession();
  const isLogged = Boolean(session);

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/70 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" aria-label="Mercado IFC — inicio">
          <Logo size={26} />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-foreground-secondary md:flex">
          <a href="#producto" className="hover:text-foreground transition-colors">
            Producto
          </a>
          <a href="#arquitectura" className="hover:text-foreground transition-colors">
            Arquitectura
          </a>
          <a href="#compliance" className="hover:text-foreground transition-colors">
            Compliance
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <AnimatedThemeToggler />
          <ConnectButton.Custom>
            {({ openConnectModal, openAccountModal, openChainModal, account, chain, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;
              if (!connected) {
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={openConnectModal}
                    disabled={!ready}
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="hidden sm:inline">Conectar wallet</span>
                  </Button>
                );
              }
              if (chain.unsupported) {
                return (
                  <Button type="button" size="sm" variant="destructive" onClick={openChainModal}>
                    Red incorrecta
                  </Button>
                );
              }
              return (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={openAccountModal}
                  className="font-mono text-xs"
                >
                  {account.displayName}
                </Button>
              );
            }}
          </ConnectButton.Custom>

          {isLogged && session ? (
            <Button size="sm" asChild>
              <Link
                href={dashboardFor(session.role)}
                aria-label={`Ir al ${session.role === 'admin' ? 'panel admin' : session.role === 'issuer' ? 'portal de emisor' : 'dashboard'}`}
              >
                <span className="hidden sm:inline">Ir al dashboard</span>
                <span className="sm:hidden">Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">Iniciar sesión</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
