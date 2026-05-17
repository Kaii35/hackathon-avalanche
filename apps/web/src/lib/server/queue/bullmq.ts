import { Queue, QueueEvents, Worker, type Processor } from 'bullmq';
import { redis } from '../redis';

/**
 * Lazy queue access. Module load no longer triggers BullMQ to instantiate
 * Queue/QueueEvents (which themselves create duplicated ioredis connections
 * that immediately try to dial Redis), so the build doesn't spam ECONNREFUSED
 * when REDIS_URL isn't configured. Real instantiation happens on first call
 * to a getter — at which point the caller actually needs the queue.
 */
type QueueName = 'matching' | 'notifications';

const queueCache: Partial<Record<QueueName, Queue>> = {};
const queueEventsCache: Partial<Record<QueueName, QueueEvents>> = {};

function getConnection() {
  return { connection: redis };
}

function lazyQueue(name: QueueName): Queue {
  let q = queueCache[name];
  if (!q) {
    q = new Queue(name, getConnection());
    queueCache[name] = q;
  }
  return q;
}

function lazyQueueEvents(name: QueueName): QueueEvents {
  let qe = queueEventsCache[name];
  if (!qe) {
    qe = new QueueEvents(name, getConnection());
    queueEventsCache[name] = qe;
  }
  return qe;
}

export const queues = {
  get matching() {
    return lazyQueue('matching');
  },
  get notifications() {
    return lazyQueue('notifications');
  },
};

export const queueEvents = {
  get matching() {
    return lazyQueueEvents('matching');
  },
  get notifications() {
    return lazyQueueEvents('notifications');
  },
};

export function startWorker<T>(name: QueueName, processor: Processor<T>): Worker<T> {
  return new Worker<T>(name, processor, getConnection());
}
