import type { NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, type Role } from '@hack/shared';
import { withAuth, type AuthContext } from './withAuth';

type RouteContext<TParams> = { params: Promise<TParams> };

type AuthHandler<TParams> = (
  req: NextRequest,
  ctx: { params: TParams } & AuthContext,
) => Promise<NextResponse> | NextResponse;

export function withRole<TParams = Record<string, never>>(
  roles: Role[],
  handler: AuthHandler<TParams>,
): (req: NextRequest, ctx: RouteContext<TParams>) => Promise<NextResponse> {
  return withAuth<TParams>(async (req, ctx) => {
    if (!roles.includes(ctx.user.role)) {
      throw new ForbiddenError('No tienes permisos para esta acción');
    }
    return handler(req, ctx);
  });
}
