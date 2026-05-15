import type { NextRequest, NextResponse } from 'next/server';
import { AuthError, type JwtPayload } from '@hack/shared';
import { SESSION_COOKIE, verifyJwt } from '../auth/jwt';

export interface AuthContext {
  user: JwtPayload;
}

type RouteContext<TParams> = { params: Promise<TParams> };

type AuthHandler<TParams> = (
  req: NextRequest,
  ctx: { params: TParams } & AuthContext,
) => Promise<NextResponse> | NextResponse;

export function withAuth<TParams = Record<string, never>>(
  handler: AuthHandler<TParams>,
): (req: NextRequest, ctx: RouteContext<TParams>) => Promise<NextResponse> {
  return async (req, ctx) => {
    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    if (!cookie) throw new AuthError('Sesión requerida', 'AUTH_REQUIRED');
    const user = await verifyJwt(cookie);
    const params = (await ctx.params) as TParams;
    return handler(req, { params, user });
  };
}
