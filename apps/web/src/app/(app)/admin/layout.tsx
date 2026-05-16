import type { ReactNode } from 'react';
import { requireRole } from '@/lib/server/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Admin portal: admin only.
  await requireRole(['admin'], '/admin');
  return <>{children}</>;
}
