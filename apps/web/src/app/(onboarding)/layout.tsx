'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Stepper } from '@hack/ui';
import { Logo } from '@/components/brand/Logo';

const STEPS = [
  { label: 'Datos', description: 'Tu información', href: '/onboarding' },
  { label: 'KYC', description: 'Documentos', href: '/onboarding/kyc' },
  { label: 'Wallet', description: 'Vincula', href: '/onboarding/wallet' },
  { label: 'Listo', description: 'Confirmación', href: '/onboarding/complete' },
];

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/onboarding';
  const stepIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.href === path),
  );
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
        <div className="mx-auto w-full max-w-3xl py-8">
          <Stepper steps={STEPS} current={stepIdx} className="mb-10" />
          {children}
        </div>
      </div>
    </div>
  );
}
