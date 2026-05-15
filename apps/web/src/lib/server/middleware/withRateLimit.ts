import type { NextRequest, NextResponse } from 'next/server';
import { RateLimitError } from '@hack/shared';
import { redis } from '../redis';

export interface RateLimitOptions {
  bucket: string;
  points: number;
  durationSec: number;
  keyFromReq?: (req: NextRequest) => string;
}

export async function enforceRateLimit(req: NextRequest, opts: RateLimitOptions): Promise<void> {
  const baseKey = opts.keyFromReq
    ? opts.keyFromReq(req)
    : (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'anon');
  const key = `ratelimit:${opts.bucket}:${baseKey}`;
  const tx = redis.multi();
  tx.incr(key);
  tx.expire(key, opts.durationSec, 'NX');
  const results = await tx.exec();
  const count = Number(results?.[0]?.[1] ?? 0);
  if (count > opts.points) {
    const ttl = await redis.ttl(key);
    throw new RateLimitError(Math.max(ttl, 1));
  }
}

type Handler<TCtx> = (req: NextRequest, ctx: TCtx) => Promise<NextResponse> | NextResponse;

export function withRateLimit<TCtx = unknown>(
  opts: RateLimitOptions,
  handler: Handler<TCtx>,
): Handler<TCtx> {
  return async (req, ctx) => {
    await enforceRateLimit(req, opts);
    return handler(req, ctx);
  };
}
