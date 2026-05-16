import type Redis from 'ioredis';
import type { ChainEvent } from '@hack/sdk';
import { prisma } from '@hack/database';

// Mirror of CHAIN_EVENTS_STREAM in @hack/sdk/events/bus.
// Inlined to avoid tsx ESM resolution issues with deep barrel re-exports.
const CHAIN_EVENTS_STREAM = 'mock-chain-events';
import { logger } from './logger.js';
import { createRedis } from './redis.js';
import { dispatch } from './handlers/index.js';
import { startHealthServer } from './health.js';

const CONSUMER_GROUP = 'indexer';
const CONSUMER_NAME = `indexer-${process.pid}`;
const BLOCK_MS = 5_000;
const BATCH_COUNT = 32;

function reviveBigints(_k: string, v: unknown): unknown {
  if (typeof v === 'string' && /^\d+$/.test(v) && v.length > 15) {
    return BigInt(v);
  }
  return v;
}

function decodeEvent(raw: string): ChainEvent {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  if (obj['blockNumber'] && typeof obj['blockNumber'] === 'string') {
    obj['blockNumber'] = BigInt(obj['blockNumber'] as string);
  }
  return obj as unknown as ChainEvent;
}

async function ensureGroup(redis: Redis): Promise<void> {
  try {
    await redis.xgroup('CREATE', CHAIN_EVENTS_STREAM, CONSUMER_GROUP, '$', 'MKSTREAM');
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) throw err;
  }
}

async function processOne(eventId: string, raw: string): Promise<void> {
  let event: ChainEvent;
  try {
    event = decodeEvent(raw);
    void reviveBigints;
  } catch (err) {
    logger.error({ err, eventId, raw }, 'failed to decode event');
    return;
  }

  const already = await prisma.processedEvent.findUnique({ where: { eventId: event.id } });
  if (already) return;

  try {
    await dispatch(event, { prisma, logger });
    await prisma.processedEvent.create({ data: { eventId: event.id, eventType: event.type } });
  } catch (err) {
    logger.error({ err, eventId, type: event.type }, 'handler failed');
    throw err;
  }
}

async function consume(redis: Redis, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const result = (await redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        CONSUMER_NAME,
        'COUNT',
        BATCH_COUNT,
        'BLOCK',
        BLOCK_MS,
        'STREAMS',
        CHAIN_EVENTS_STREAM,
        '>',
      )) as [string, [string, string[]][]][] | null;

      if (!result) continue;
      for (const [, entries] of result) {
        for (const [streamId, fields] of entries) {
          const idx = fields.indexOf('event');
          const raw = idx >= 0 ? fields[idx + 1] : undefined;
          if (!raw) {
            await redis.xack(CHAIN_EVENTS_STREAM, CONSUMER_GROUP, streamId);
            continue;
          }
          try {
            await processOne(streamId, raw);
            await redis.xack(CHAIN_EVENTS_STREAM, CONSUMER_GROUP, streamId);
          } catch {
            // Leave un-acked so it can be retried via XPENDING/XCLAIM later.
          }
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      logger.error({ err }, 'xreadgroup loop error; backing off');
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
}

async function main() {
  logger.info('indexer arrancando...');
  const redis = createRedis();
  await ensureGroup(redis);
  const port = Number(process.env.INDEXER_PORT ?? 3001);
  const health = startHealthServer(port, logger);

  const ctrl = new AbortController();
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown initiated');
    ctrl.abort();
    health.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await consume(redis, ctrl.signal);
}

main().catch((err) => {
  logger.error({ err }, 'fatal indexer error');
  process.exit(1);
});
