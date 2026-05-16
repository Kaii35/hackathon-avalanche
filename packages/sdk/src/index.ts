export * from './client';
export * from './eip712';
export * from './blockchain';
export * from './events';

// Explicit re-exports — tsx ESM static analysis sometimes drops names that
// only reach the package root through chained `export *` barrels.
export { CHAIN_EVENTS_STREAM, EventBus, getEventBus, setEventBus } from './events/bus';
export type {
  ChainEvent,
  EventName,
  TransferEvent,
  OrderPostedEvent,
  OrderCancelledEvent,
  OrderFilledEvent,
  TradeExecutedEvent,
  IdentityRegisteredEvent,
  WalletFrozenEvent,
  ForcedTransferEvent,
  TokenDeployedEvent,
} from './events/types';
