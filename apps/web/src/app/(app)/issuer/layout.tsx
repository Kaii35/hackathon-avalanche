import type { ReactNode } from 'react';
import { requireRole } from '@/lib/server/auth/session';

export default async function IssuerLayout({ children }: { children: ReactNode }) {
  // Issuer portal: only `issuer` and `admin` roles get through. `investor`
  // gets bounced to /investor (their own portal).
  await requireRole(['issuer'], '/issuer');
  return <>{children}</>;
}
