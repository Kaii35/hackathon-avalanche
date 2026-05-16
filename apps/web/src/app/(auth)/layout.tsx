import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { getSession } from '@/lib/server/auth/session';
import { DisconnectWalletOnAuth } from '@/components/auth/DisconnectWalletOnAuth';

const PORTAL_FOR = {
  investor: '/investor',
  issuer: '/issuer',
  admin: '/admin',
} as const;

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // If the user already has a valid session, /login and /register make no
  // sense — bounce them to the portal that matches their role.
  const session = await getSession();
  if (session) redirect(PORTAL_FOR[session.role]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <DisconnectWalletOnAuth />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-mesh opacity-80" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[420px] [background-image:radial-gradient(circle_at_50%_-10%,rgba(42,91,255,0.18)_0,transparent_55%)]"
      />
      <div className="container flex min-h-screen flex-col">
        <header className="flex h-14 items-center">
          <Link href="/" aria-label="Mercado IFC — inicio">
            <Logo size={26} />
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
