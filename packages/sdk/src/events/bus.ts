import type Redis from 'ioredis';
import type { ChainEvent, EventName } from './types';

export const CHAIN_EVENTS_STREAM = 'mock-chain-events';

type Listener = (event: ChainEvent) => void;

export interface EventBusOptions {
  redis?: Redis;
  streamKey?: string;
  maxStreamLen?: number;
}

export class EventBus {
  private readonly listeners = new Map<EventName | '*', Set<Listener>>();
  private readonly redis: Redis | undefined;
  private readonly streamKey: string;
  private readonly maxStreamLen: number;

  constructor(opts: EventBusOptions = {}) {
    this.redis = opts.redis;
    this.streamKey = opts.streamKey ?? CHAIN_EVENTS_STREAM;
    this.maxStreamLen = opts.maxStreamLen ?? 10_000;
  }

  on(event: EventName | '*', listener: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => set?.delete(listener);
  }

  async emit(event: ChainEvent): Promise<void> {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    for (const listener of this.listeners.get('*') ?? []) {
      listener(event);
    }
    if (this.redis) {
      await this.redis.xadd(
        this.streamKey,
        'MAXLEN',
        '~',
        this.maxStreamLen.toString(),
        '*',
        'event',
        JSON.stringify(event, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
      );
    }
  }
}

let singleton: EventBus | undefined;

export function setEventBus(bus: EventBus): void {
  singleton = bus;
}

export function getEventBus(): EventBus {
  if (!singleton) {
    singleton = new EventBus();
  }
  return singleton;
}
