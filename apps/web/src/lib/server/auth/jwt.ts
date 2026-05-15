import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload } from '@hack/shared';
import { AuthError } from '@hack/shared';

const ISSUER = 'mercado-ifc';
const AUDIENCE = 'mercado-ifc-web';
const TOKEN_TTL = '7d';

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET no configurado o demasiado corto (>=32 chars)');
  }
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new AuthError('Sesión inválida');
    }
    const role = payload.role;
    if (role !== 'investor' && role !== 'issuer' && role !== 'admin') {
      throw new AuthError('Sesión inválida');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Sesión inválida o expirada', 'AUTH_INVALID');
  }
}

export const SESSION_COOKIE = 'ifc_session';
export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};
