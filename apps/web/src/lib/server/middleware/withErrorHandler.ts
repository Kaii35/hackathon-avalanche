import type { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger';
import { toErrorResponse } from '../errors/errorMapper';

type AnyCtx = { params: Promise<unknown> } | undefined;

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
