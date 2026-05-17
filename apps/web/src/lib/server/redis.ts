import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * No-op Proxy stub used when REDIS_URL is not configured (typical Vercel
 * preview / first deploy). Satisfies the ioredis surface enough for our
 * callers — every command resolves to `null`, every event listener call
 * returns the stub itself for chaining. Zero TCP attempts, zero ECONNREFUSED
 * spam in build logs.
 *
 * Trade-off: rate-limiting / orderbook caching silently degrade (always a
 * cache miss, no rate enforcement) — but the app still serves requests.
 * Set REDIS_URL to enable the real client.
 */
function createNoopStub(): Redis {
  const stub: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined; // not a thenable
        // Event-emitter chain methods return the stub for fluency.
        if (
          prop === 'on' ||
          prop === 'once' ||
          prop === 'off' ||
          prop === 'addListener' ||
          prop === 'removeListener' ||
          prop === 'emit'
        ) {
          return () => stub;
        }
        // disconnect / quit are sync void calls in some ioredis versions.
        if (prop === 'disconnect' || prop === 'quit' || prop === 'end') {
          return () => Promise.resolve('OK');
        }
        // Every other access is assumed to be a Redis command — resolves null.
        return () => Promise.resolve(null);
      },
    },
  );
  return stub as Redis;
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
