import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/server/auth/session';
import { DisconnectWalletOnAuth } from '@/components/auth/DisconnectWalletOnAuth';

const PORTAL_FOR = {
  investor: '/investor',
  issuer: '/issuer',
  admin: '/admin',
} as const;

/**
 * Auth route group layout. Only handles cross-cutting concerns:
 *   - bounce already-logged-in users to their portal
 *   - disconnect any wagmi wallet still connected from a previous session
 *
 * Visual chrome (shader background, logo) is rendered by `AuthShell` inside
 * each page, so individual pages can opt out or use a different shell.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session) redirect(PORTAL_FOR[session.role]);

  return (
    <>
      <DisconnectWalletOnAuth />
      {children}
    </>
  );
}
