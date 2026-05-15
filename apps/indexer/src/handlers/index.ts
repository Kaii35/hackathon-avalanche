import type { ChainEvent } from '@hack/sdk';
import type { PrismaClient } from '@hack/database';
import { handleTransfer } from './transfer.handler.js';
import { handleTradeExecuted } from './trade.handler.js';
import { handleOrderEvent } from './order.handler.js';
import { handleIdentityEvent, handleFreezeEvent } from './identity.handler.js';
import { handleTokenDeployed } from './token.handler.js';
import { handleForcedTransfer } from './forcedTransfer.handler.js';
import type { Logger } from '../logger.js';

export interface HandlerContext {
  prisma: PrismaClient;
  logger: Logger;
}

export async function dispatch(event: ChainEvent, ctx: HandlerContext): Promise<void> {
  switch (event.type) {
    case 'Transfer':
      await handleTransfer(event, ctx);
      return;
    case 'TradeExecuted':
      await handleTradeExecuted(event, ctx);
      return;
    case 'OrderPosted':
    case 'OrderCancelled':
    case 'OrderFilled':
      await handleOrderEvent(event, ctx);
      return;
    case 'IdentityRegistered':
    case 'IdentityRemoved':
      await handleIdentityEvent(event, ctx);
      return;
    case 'WalletFrozen':
    case 'WalletUnfrozen':
      await handleFreezeEvent(event, ctx);
      return;
    case 'TokenDeployed':
      await handleTokenDeployed(event, ctx);
      return;
    case 'ForcedTransfer':
      await handleForcedTransfer(event, ctx);
      return;
    default: {
      const _exhaustive: never = event;
      ctx.logger.warn({ event: _exhaustive }, 'unhandled event type');
    }
  }
}
