// Minimal ABIs for the Fuji watcher. Only the events we listen to.

export const SECURITY_TOKEN_EVENTS = [
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'WalletFrozenSet',
    type: 'event',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    name: 'WalletUnfrozenSet',
    type: 'event',
    inputs: [{ name: 'wallet', type: 'address', indexed: true }],
  },
  {
    name: 'ForcedTransferExecuted',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

export const SETTLEMENT_EVENTS = [
  {
    name: 'TradeExecuted',
    type: 'event',
    inputs: [
      { name: 'buyOrderHash', type: 'bytes32', indexed: true },
      { name: 'sellOrderHash', type: 'bytes32', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: false },
      { name: 'token', type: 'address', indexed: false },
      { name: 'paymentToken', type: 'address', indexed: false },
      { name: 'fillQty', type: 'uint256', indexed: false },
      { name: 'executionPrice', type: 'uint256', indexed: false },
      { name: 'paymentAmount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const IDENTITY_REGISTRY_EVENTS = [
  {
    name: 'AddressVerified',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
  },
  {
    name: 'AddressRevoked',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
  },
] as const;

export const TOKEN_FACTORY_EVENTS = [
  {
    name: 'OfferingDeployed',
    type: 'event',
    inputs: [
      { name: 'offeringId', type: 'bytes32', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'issuerAdmin', type: 'address', indexed: true },
      { name: 'complianceAgent', type: 'address', indexed: false },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'initialSupply', type: 'uint256', indexed: false },
      { name: 'initialRecipient', type: 'address', indexed: false },
    ],
  },
] as const;

export const TOKEN_FACTORY_VIEWS = [
  {
    name: 'allOfferings',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;
