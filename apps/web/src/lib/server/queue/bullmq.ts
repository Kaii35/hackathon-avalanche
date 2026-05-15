import { Queue, QueueEvents, Worker, type Processor } from 'bullmq';
import { redis } from '../redis';

const connection = { connection: redis };

export const queues = {
  matching: new Queue('matching', connection),
  notifications: new Queue('notifications', connection),
};

export const queueEvents = {
  matching: new QueueEvents('matching', connection),
  notifications: new QueueEvents('notifications', connection),
};

export function startWorker<T>(
  name: 'matching' | 'notifications',
  processor: Processor<T>,
): Worker<T> {
  return new Worker<T>(name, processor, connection);
}
