import type { Address } from 'viem';

export type EventName =
  | 'IdentityRegistered'
  | 'IdentityRemoved'
  | 'WalletFrozen'
  | 'WalletUnfrozen'
  | 'TokenDeployed'
  | 'Transfer'
  | 'ForcedTransfer'
  | 'OrderPosted'
  | 'OrderCancelled'
  | 'OrderFilled'
  | 'TradeExecuted';

export interface BaseEvent {
  id: string;
  type: EventName;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number;
}

export interface IdentityRegisteredEvent extends BaseEvent {
  type: 'IdentityRegistered';
  wallet: Address;
  jurisdiction: number;
  accredited: boolean;
  claimHash: `0x${string}`;
}

export interface IdentityRemovedEvent extends BaseEvent {
  type: 'IdentityRemoved';
  wallet: Address;
}

export interface WalletFrozenEvent extends BaseEvent {
  type: 'WalletFrozen';
  wallet: Address;
  reason: string;
}

export interface WalletUnfrozenEvent extends BaseEvent {
  type: 'WalletUnfrozen';
  wallet: Address;
}

export interface TokenDeployedEvent extends BaseEvent {
  type: 'TokenDeployed';
  offeringId: string;
  tokenAddress: Address;
  initialSupply: string;
}

export interface TransferEvent extends BaseEvent {
  type: 'Transfer';
  token: Address;
  from: Address;
  to: Address;
  value: string;
}

export interface ForcedTransferEvent extends BaseEvent {
  type: 'ForcedTransfer';
  token: Address;
  from: Address;
  to: Address;
  value: string;
  reason: string;
}

export interface OrderPostedEvent extends BaseEvent {
  type: 'OrderPosted';
  orderHash: `0x${string}`;
  maker: Address;
  token: Address;
  side: 0 | 1;
  qty: string;
  price: string;
  expiresAt: number;
}

export interface OrderCancelledEvent extends BaseEvent {
  type: 'OrderCancelled';
  orderHash: `0x${string}`;
  maker: Address;
}

export interface OrderFilledEvent extends BaseEvent {
  type: 'OrderFilled';
  orderHash: `0x${string}`;
  filledQty: string;
  remainingQty: string;
}

export interface TradeExecutedEvent extends BaseEvent {
  type: 'TradeExecuted';
  buyOrderHash: `0x${string}`;
  sellOrderHash: `0x${string}`;
  token: Address;
  buyer: Address;
  seller: Address;
  qty: string;
  price: string;
  feeBps: number;
}

export type ChainEvent =
  | IdentityRegisteredEvent
  | IdentityRemovedEvent
  | WalletFrozenEvent
  | WalletUnfrozenEvent
  | TokenDeployedEvent
  | TransferEvent
  | ForcedTransferEvent
  | OrderPostedEvent
  | OrderCancelledEvent
  | OrderFilledEvent
  | TradeExecutedEvent;
