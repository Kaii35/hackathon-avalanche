import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedis(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  // lazyConnect: true → no TCP attempt until the first command. Critical for
  // serverless / build-time: Next's "Collecting page data" step imports
  // server modules, which used to trigger an immediate connect to
  // localhost:6379 and flood the build logs with ECONNREFUSED. With lazy
  // connect, the module loads cleanly; only routes that actually call Redis
  // pay the connection cost at request time.
  // maxRetriesPerRequest: 1 (was null = forever) → if Redis is unreachable
  // at runtime we fail fast instead of hanging serverless functions until
  // they timeout.
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    // Silently swallow connection failures during build / when Redis isn't
    // available — callers still get a proper rejection when they try to
    // issue a command, but we don't crash the process from a stray event.
  });
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[redis] connection error (non-fatal):', err.message);
    }
  });
  return client;
}

export const redis: Redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
