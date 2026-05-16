import type { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import { toErrorResponse } from '../errors/errorMapper';

// Next.js 15's generated route types require the second arg to be a defined
// object with `params: Promise<...>`. Don't allow `| undefined` here or
// `.next/types/app/.../route.ts` will fail the type check on build.
type AnyCtx = { params: Promise<Record<string, string | string[]>> };

export function withErrorHandler<TCtx extends AnyCtx = AnyCtx>(
  handler: (req: NextRequest, ctx: TCtx) => Promise<NextResponse> | NextResponse,
): (req: NextRequest, ctx: TCtx) => Promise<NextResponse> {
  return async (req, ctx) => {
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    const start = Date.now();
    try {
      const res = await handler(req, ctx);
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          status: res.status,
          ms: Date.now() - start,
        },
        'request',
      );
      res.headers.set('x-request-id', requestId);
      return res;
    } catch (err) {
      const res = toErrorResponse(err, requestId);
      res.headers.set('x-request-id', requestId);
      logger.warn(
        {
          requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          status: res.status,
          ms: Date.now() - start,
        },
        'request_error',
      );
      return res;
    }
  };
}
