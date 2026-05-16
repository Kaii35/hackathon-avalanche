import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
  type Log,
  parseAbiItem,
  type AbiEvent,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import type { PrismaClient } from '@hack/database';
import type { ChainEvent } from '@hack/sdk';
import type { Logger } from '../logger.js';
import { dispatch } from '../handlers/index.js';
import {
  SECURITY_TOKEN_EVENTS,
  SETTLEMENT_EVENTS,
  IDENTITY_REGISTRY_EVENTS,
  TOKEN_FACTORY_VIEWS,
} from './abi.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const RPC_URL = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';

const BACKFILL_FROM_BLOCK = BigInt(process.env.INDEXER_FUJI_FROM_BLOCK ?? '55000000');
// Fuji finality is ~1 block but watchContractEvent already buffers; small lag
// (poll interval) gives the chain time to settle.
const POLL_INTERVAL_MS = Number(process.env.INDEXER_FUJI_POLL_MS ?? '4000');
// Public Fuji RPC limit is 2048 blocks per getLogs; 2000 keeps margin.
const BACKFILL_CHUNK = BigInt(process.env.INDEXER_FUJI_CHUNK ?? '2000');

interface FujiAddresses {
  identityRegistry: Address;
  settlement: Address;
  tokenFactory: Address;
}

function readAddresses(): FujiAddresses | null {
  const identityRegistry = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as Address | undefined;
  const settlement = process.env.NEXT_PUBLIC_SETTLEMENT as Address | undefined;
  const tokenFactory = process.env.NEXT_PUBLIC_TOKEN_FACTORY as Address | undefined;
  if (!identityRegistry || !settlement || !tokenFactory) return null;
  return { identityRegistry, settlement, tokenFactory };
}

// -----------------------------------------------------------------------------
// Helpers — turn raw on-chain Log into the same ChainEvent shape mock chain emits
// -----------------------------------------------------------------------------

function eventId(log: { transactionHash: `0x${string}` | null; logIndex: number | null }): string {
  return `${log.transactionHash ?? '0xunknown'}:${log.logIndex ?? 0}`;
}

interface ChainCtx {
  prisma: PrismaClient;
  logger: Logger;
}

async function persistAndDispatch(ev: ChainEvent, ctx: ChainCtx): Promise<void> {
  // Idempotency: same eventId can arrive twice (backfill overlapping the live
  // watch on startup). ProcessedEvent table dedupes across both code paths.
  const already = await ctx.prisma.processedEvent.findUnique({ where: { eventId: ev.id } });
  if (already) return;

  try {
    await dispatch(ev, ctx);
    await ctx.prisma.processedEvent.create({
      data: { eventId: ev.id, eventType: ev.type },
    });
  } catch (err) {
    ctx.logger.error(
      { err, eventId: ev.id, type: ev.type },
      'fuji handler failed (will retry on next observation)',
    );
  }
}

// -----------------------------------------------------------------------------
// Log → ChainEvent mappers
// -----------------------------------------------------------------------------

type LogWithArgs<TArgs> = Log & {
  args: TArgs;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  eventName: string;
};

function mapTransfer(
  token: Address,
  log: LogWithArgs<{ from: Address; to: Address; value: bigint }>,
): ChainEvent {
  return {
    id: eventId(log),
    type: 'Transfer',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    token,
    from: log.args.from.toLowerCase() as Address,
    to: log.args.to.toLowerCase() as Address,
    value: log.args.value.toString(),
  } as ChainEvent;
}

function mapFrozen(log: LogWithArgs<{ wallet: Address; reason: string }>): ChainEvent {
  return {
    id: eventId(log),
    type: 'WalletFrozen',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    wallet: log.args.wallet.toLowerCase() as Address,
    reason: log.args.reason,
  } as ChainEvent;
}

function mapUnfrozen(log: LogWithArgs<{ wallet: Address }>): ChainEvent {
  return {
    id: eventId(log),
    type: 'WalletUnfrozen',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    wallet: log.args.wallet.toLowerCase() as Address,
  } as ChainEvent;
}

function mapForcedTransfer(
  token: Address,
  log: LogWithArgs<{ from: Address; to: Address; value: bigint; reason: string }>,
): ChainEvent {
  return {
    id: eventId(log),
    type: 'ForcedTransfer',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    token,
    from: log.args.from.toLowerCase() as Address,
    to: log.args.to.toLowerCase() as Address,
    value: log.args.value.toString(),
    reason: log.args.reason,
  } as ChainEvent;
}

function mapIdentityVerified(log: LogWithArgs<{ user: Address; verifier: Address }>): ChainEvent {
  // Map AddressVerified → IdentityRegistered (jurisdiction/accredited are
  // tracked off-chain in Sumsub; we keep zero defaults on-chain to stay
  // compatible with the existing handler).
  return {
    id: eventId(log),
    type: 'IdentityRegistered',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    wallet: log.args.user.toLowerCase() as Address,
    jurisdiction: 484, // MX default; off-chain reconcile overrides this if needed
    accredited: false,
    claimHash:
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
  } as ChainEvent;
}

function mapIdentityRevoked(log: LogWithArgs<{ user: Address; verifier: Address }>): ChainEvent {
  return {
    id: eventId(log),
    type: 'IdentityRemoved',
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Math.floor(Date.now() / 1000),
    wallet: log.args.user.toLowerCase() as Address,
  } as ChainEvent;
}

// -----------------------------------------------------------------------------
// Token discovery
// -----------------------------------------------------------------------------

async function discoverTokens(
  client: PublicClient,
  factory: Address,
  logger: Logger,
): Promise<Address[]> {
  try {
    const tokens = (await client.readContract({
      address: factory,
      abi: TOKEN_FACTORY_VIEWS,
      functionName: 'allOfferings',
    })) as Address[];
    logger.info({ count: tokens.length, factory }, 'fuji: discovered tokens via TokenFactory');
    return tokens;
  } catch (err) {
    logger.warn({ err }, 'fuji: TokenFactory.allOfferings failed; falling back to ARKDEMO only');
    // Fallback for environments where the factory was redeployed but env didn't refresh
    const arkdemo = '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26' as Address;
    return [arkdemo];
  }
}

// -----------------------------------------------------------------------------
// Backfill: getLogs over historical range chunked by BACKFILL_CHUNK
// -----------------------------------------------------------------------------

async function backfillRange(
  client: PublicClient,
  contract: Address,
  abi: readonly AbiEvent[],
  fromBlock: bigint,
  toBlock: bigint,
  handler: (log: Log) => Promise<void>,
  logger: Logger,
): Promise<void> {
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const chunkEnd = cursor + BACKFILL_CHUNK > toBlock ? toBlock : cursor + BACKFILL_CHUNK;
    try {
      const logs = await client.getLogs({
        address: contract,
        events: abi,
        fromBlock: cursor,
        toBlock: chunkEnd,
      });
      for (const log of logs) {
        try {
          await handler(log);
        } catch (err) {
          logger.error({ err, contract, log: log.transactionHash }, 'backfill log handler failed');
        }
      }
    } catch (err) {
      logger.warn({ err, contract, cursor, chunkEnd }, 'getLogs chunk failed; skipping');
    }
    cursor = chunkEnd + 1n;
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface FujiWatcherHandle {
  stop: () => void;
}

export async function startFujiWatcher(ctx: ChainCtx): Promise<FujiWatcherHandle | null> {
  const addresses = readAddresses();
  if (!addresses) {
    ctx.logger.warn(
      'fuji watcher: missing contract addresses in env (NEXT_PUBLIC_IDENTITY_REGISTRY/SETTLEMENT/TOKEN_FACTORY); skipping',
    );
    return null;
  }

  const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });
  const tokens = await discoverTokens(client, addresses.tokenFactory, ctx.logger);
  const currentBlock = await client.getBlockNumber();

  ctx.logger.info(
    { rpc: RPC_URL, tokens, currentBlock: currentBlock.toString() },
    'fuji watcher: backfilling + going live',
  );

  // ---------------------------------------------------------------------------
  // Backfill (one-shot)
  // ---------------------------------------------------------------------------

  const fromBlock = BACKFILL_FROM_BLOCK > currentBlock ? currentBlock : BACKFILL_FROM_BLOCK;

  // Per-token: Transfer + Freeze + ForcedTransfer
  for (const token of tokens) {
    await backfillRange(
      client,
      token,
      SECURITY_TOKEN_EVENTS as unknown as readonly AbiEvent[],
      fromBlock,
      currentBlock,
      async (log) => {
        const l = log as LogWithArgs<Record<string, unknown>>;
        if (l.eventName === 'Transfer') {
          await persistAndDispatch(
            mapTransfer(token, l as LogWithArgs<{ from: Address; to: Address; value: bigint }>),
            ctx,
          );
        } else if (l.eventName === 'WalletFrozenSet') {
          await persistAndDispatch(
            mapFrozen(l as LogWithArgs<{ wallet: Address; reason: string }>),
            ctx,
          );
        } else if (l.eventName === 'WalletUnfrozenSet') {
          await persistAndDispatch(mapUnfrozen(l as LogWithArgs<{ wallet: Address }>), ctx);
        } else if (l.eventName === 'ForcedTransferExecuted') {
          await persistAndDispatch(
            mapForcedTransfer(
              token,
              l as LogWithArgs<{ from: Address; to: Address; value: bigint; reason: string }>,
            ),
            ctx,
          );
        }
      },
      ctx.logger,
    );
  }

  // Identity registry
  await backfillRange(
    client,
    addresses.identityRegistry,
    IDENTITY_REGISTRY_EVENTS as unknown as readonly AbiEvent[],
    fromBlock,
    currentBlock,
    async (log) => {
      const l = log as LogWithArgs<{ user: Address; verifier: Address }>;
      if (l.eventName === 'AddressVerified') {
        await persistAndDispatch(mapIdentityVerified(l), ctx);
      } else if (l.eventName === 'AddressRevoked') {
        await persistAndDispatch(mapIdentityRevoked(l), ctx);
      }
    },
    ctx.logger,
  );

  // Settlement (note: TradeExecuted is informational here — trades are written
  // by the matching service in apps/web; we still want to surface the on-chain
  // event for audit/credibility, so we observe but do not duplicate-insert).
  // The existing handleTradeExecuted is a no-op on duplicate txHash so this
  // is safe.
  await backfillRange(
    client,
    addresses.settlement,
    SETTLEMENT_EVENTS as unknown as readonly AbiEvent[],
    fromBlock,
    currentBlock,
    async (log) => {
      const l = log as LogWithArgs<{
        buyOrderHash: `0x${string}`;
        sellOrderHash: `0x${string}`;
        buyer: Address;
        seller: Address;
        token: Address;
        paymentToken: Address;
        fillQty: bigint;
        executionPrice: bigint;
        paymentAmount: bigint;
        fee: bigint;
      }>;
      const feeBps =
        l.args.paymentAmount > 0n
          ? Number((l.args.fee * 10_000n) / (l.args.paymentAmount + l.args.fee))
          : 0;
      await persistAndDispatch(
        {
          id: eventId(l),
          type: 'TradeExecuted',
          txHash: l.transactionHash,
          blockNumber: l.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          buyOrderHash: l.args.buyOrderHash,
          sellOrderHash: l.args.sellOrderHash,
          token: l.args.token,
          buyer: l.args.buyer,
          seller: l.args.seller,
          qty: l.args.fillQty.toString(),
          price: l.args.executionPrice.toString(),
          feeBps,
        } satisfies ChainEvent,
        ctx,
      );
    },
    ctx.logger,
  );

  ctx.logger.info(
    { tokens: tokens.length },
    'fuji watcher: backfill complete; switching to live tail',
  );

  // ---------------------------------------------------------------------------
  // Live tail via watchContractEvent (polling — Avalanche RPC public has no WSS)
  // ---------------------------------------------------------------------------

  const unwatchers: Array<() => void> = [];

  for (const token of tokens) {
    const unwatchTransfer = client.watchContractEvent({
      address: token,
      abi: SECURITY_TOKEN_EVENTS,
      eventName: 'Transfer',
      pollingInterval: POLL_INTERVAL_MS,
      onLogs: async (logs) => {
        for (const log of logs) {
          await persistAndDispatch(
            mapTransfer(
              token,
              log as unknown as LogWithArgs<{ from: Address; to: Address; value: bigint }>,
            ),
            ctx,
          );
        }
      },
      onError: (err) => ctx.logger.warn({ err, token }, 'watchContractEvent transfer error'),
    });
    unwatchers.push(unwatchTransfer);

    const unwatchFrozen = client.watchContractEvent({
      address: token,
      abi: SECURITY_TOKEN_EVENTS,
      eventName: 'WalletFrozenSet',
      pollingInterval: POLL_INTERVAL_MS,
      onLogs: async (logs) => {
        for (const log of logs) {
          await persistAndDispatch(
            mapFrozen(log as unknown as LogWithArgs<{ wallet: Address; reason: string }>),
            ctx,
          );
        }
      },
      onError: (err) => ctx.logger.warn({ err, token }, 'watchContractEvent frozen error'),
    });
    unwatchers.push(unwatchFrozen);

    const unwatchForced = client.watchContractEvent({
      address: token,
      abi: SECURITY_TOKEN_EVENTS,
      eventName: 'ForcedTransferExecuted',
      pollingInterval: POLL_INTERVAL_MS,
      onLogs: async (logs) => {
        for (const log of logs) {
          await persistAndDispatch(
            mapForcedTransfer(
              token,
              log as unknown as LogWithArgs<{
                from: Address;
                to: Address;
                value: bigint;
                reason: string;
              }>,
            ),
            ctx,
          );
        }
      },
      onError: (err) => ctx.logger.warn({ err, token }, 'watchContractEvent forced error'),
    });
    unwatchers.push(unwatchForced);
  }

  // Identity registry — keeps wallet KYC status mirrored in DB
  const unwatchIdentity = client.watchContractEvent({
    address: addresses.identityRegistry,
    abi: IDENTITY_REGISTRY_EVENTS,
    pollingInterval: POLL_INTERVAL_MS,
    onLogs: async (logs) => {
      for (const log of logs) {
        const l = log as unknown as LogWithArgs<{ user: Address; verifier: Address }>;
        if (l.eventName === 'AddressVerified') {
          await persistAndDispatch(mapIdentityVerified(l), ctx);
        } else if (l.eventName === 'AddressRevoked') {
          await persistAndDispatch(mapIdentityRevoked(l), ctx);
        }
      }
    },
    onError: (err) => ctx.logger.warn({ err }, 'watchContractEvent identity error'),
  });
  unwatchers.push(unwatchIdentity);

  ctx.logger.info(
    { watchers: unwatchers.length, tokens: tokens.length },
    'fuji watcher: live tail active',
  );

  return {
    stop: () => {
      for (const u of unwatchers) {
        try {
          u();
        } catch {
          // ignore
        }
      }
    },
  };
}

// Re-export for callers that want to type the contract addresses
export type { FujiAddresses };
// silence unused parseAbiItem warning if treeshakers complain
void parseAbiItem;
