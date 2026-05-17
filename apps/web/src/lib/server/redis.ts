import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * No-op Proxy stub used when REDIS_URL is not configured (typical Vercel
 * preview / first deploy). The stub is universally chainable AND awaitable:
 *
 *   await redis.get('k')                 → null
 *   redis.multi().incr('k').exec()       → no throw, awaits to null
 *   redis.on('error', cb)                → registered as no-op
 *   redis.pipeline().setex(...).exec()   → no throw
 *
 * The trick: target the Proxy on a callable (function), so `apply` works for
 * `stub()`-style calls AND `get` works for `stub.method` access. The `then`
 * key resolves to null on await. Every other access returns a fresh stub —
 * which is itself callable, awaitable, and chainable. Covers ioredis +
 * pipeline + BullMQ duck-typing without touching the network.
 *
 * Trade-off: rate-limiting and orderbook caching silently degrade (rate
 * never enforced, every read is a cache miss). The app still serves
 * requests correctly. Set REDIS_URL to enable a real client.
 */
function createNoopStub(): Redis {
  const makeStub = (): unknown => {
    // Callable target → apply trap intercepts `stub()` invocations.
    const target = function noop() {} as unknown as object;
    return new Proxy(target, {
      get(_t, prop) {
        // Thenable: `await stub` resolves to null.
        if (prop === 'then') {
          return (onResolve: (value: unknown) => unknown) => onResolve(null);
        }
        // Symbols (iterators, toPrimitive, etc.) — return undefined so the
        // runtime falls back to defaults instead of treating the stub as
        // iterable when it isn't.
        if (typeof prop === 'symbol') return undefined;
        // Sync-void operations some callers expect to return immediately.
        if (prop === 'disconnect' || prop === 'quit' || prop === 'end') {
          return () => Promise.resolve('OK');
        }
        // Any other property access returns a fresh stub (also callable +
        // awaitable + chainable). That covers `redis.get`, `redis.multi`,
        // `redis.on`, pipeline chains, etc.
        return makeStub();
      },
      apply() {
        // Calling the stub returns another stub — so `redis.multi().incr(k)`
        // works because `.multi()` returns a stub which itself has `.incr`.
        return makeStub();
      },
    });
  };
  return makeStub() as Redis;
}

function createRedis(): Redis {
  // If REDIS_URL isn't set, return the no-op stub. This is the critical fix
  // for Vercel deploys without a managed Redis: previously we defaulted to
  // 'redis://localhost:6379' which doesn't exist in the build env, flooding
  // logs with ECONNREFUSED. The stub completes cleanly.
  if (!process.env.REDIS_URL) {
    return createNoopStub();
  }

  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  // Always register an error listener so transient connection issues don't
  // crash the process via Node's "Unhandled error event" default handler.
  client.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[redis] connection error (non-fatal):', err.message);
    }
  });
  return client;
}

export const redis: Redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
