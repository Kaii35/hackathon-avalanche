import type { ReactNode } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { AppCommandPalette } from '@/components/shell/AppCommandPalette';
import { requireSession } from '@/lib/server/auth/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Server-side auth gate. Without a valid session cookie this redirects to
  // /login?from=/<original> before any portal layout renders. Per-role gates
  // live in (app)/issuer/layout.tsx and (app)/admin/layout.tsx.
  await requireSession('/investor');

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <AppCommandPalette />
    </div>
  );
}
