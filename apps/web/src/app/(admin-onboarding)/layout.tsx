import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

/**
 * Standalone layout for the admin post-register wallet-linking screen.
 * Deliberately does NOT mount the (app) shell (Sidebar + Topbar + Command
 * palette) nor the investor/issuer onboarding Stepper — admins skip all
 * KYC steps so a 4-dot stepper would be misleading.
 */
export default function AdminOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-mesh opacity-70" />
      <div className="container flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" aria-label="Arca — inicio">
            <Logo size={26} />
          </Link>
          <Link href="/login" className="text-xs text-foreground-tertiary hover:text-foreground">
            Salir
          </Link>
        </header>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center py-8">{children}</div>
      </div>
    </div>
  );
}
