import { PrismaClient, Prisma } from '@prisma/client';

const SLOW_QUERY_MS = 200;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
  });

  if (process.env.NODE_ENV !== 'production') {
    type QueryEvent = { duration: number; query: string };
    (client as unknown as { $on: (e: 'query', cb: (ev: QueryEvent) => void) => void }).$on(
      'query',
      (ev) => {
        if (ev.duration > SLOW_QUERY_MS) {
          // Slow-query surface; consumers wire to their own logger if needed.
          // eslint-disable-next-line no-console
          console.warn(`[prisma] slow query ${ev.duration}ms: ${ev.query.slice(0, 200)}`);
        }
      },
    );
  }

  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { Prisma };
export * from '@prisma/client';
