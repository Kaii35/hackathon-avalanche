import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { JwtPayload, Role } from '@hack/shared';
import { SESSION_COOKIE, verifyJwt } from './jwt';

/**
 * Reads and validates the session cookie inside a Server Component or
 * Server Action. Returns the JWT payload or null when no valid session.
 */
export async function getSession(): Promise<JwtPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyJwt(token);
  } catch {
    return null;
  }
}

/**
 * Server-side guard. Redirects to /login (preserving the original target
 * via ?from=...) when no valid session is present. Returns the session
 * to the caller otherwise.
 */
export async function requireSession(redirectFrom: string): Promise<JwtPayload> {
  const session = await getSession();
  if (!session) {
    const target = `/login?from=${encodeURIComponent(redirectFrom)}`;
    redirect(target);
  }
  return session;
}

const PORTAL_FOR: Record<Role, string> = {
  investor: '/investor',
  issuer: '/issuer',
  admin: '/admin',
};

/**
 * Role guard. Redirects authenticated-but-wrong-role users to their own
 * portal. `admin` is treated as a superuser and may access any portal.
 */
export async function requireRole(allowed: Role[], redirectFrom: string): Promise<JwtPayload> {
  const session = await requireSession(redirectFrom);
  const ok = allowed.includes(session.role) || session.role === 'admin';
  if (!ok) redirect(PORTAL_FOR[session.role]);
  return session;
}
