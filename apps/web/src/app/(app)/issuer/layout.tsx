import type { ReactNode } from 'react';
import { requireRole } from '@/lib/server/auth/session';

export default async function IssuerLayout({ children }: { children: ReactNode }) {
  // Issuer portal: `issuer` and `admin` get through. `admin` is a superset
  // (can do everything an issuer does plus regulator/compliance ops).
  // `investor` gets bounced to /investor (their own portal).
  await requireRole(['issuer', 'admin'], '/issuer');
  return <>{children}</>;
}
