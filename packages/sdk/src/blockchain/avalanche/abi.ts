/**
 * Hand-written minimal ABI fragments for the Arkangeles contracts deployed on
 * Avalanche Fuji. Derived from packages/blockchain/src/*.sol and the compiled
 * Foundry output (packages/blockchain/out/). Using hand-written fragments
 * avoids coupling this package to the Foundry build output at runtime.
 */

// ─── IdentityRegistry ────────────────────────────────────────────────────────

export const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'isVerified',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'verifyAddress',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAddress',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'AddressVerified',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AddressRevoked',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
  },
] as const;

// ─── ComplianceManager ────────────────────────────────────────────────────────

export const COMPLIANCE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'bindModule',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'module', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unbindModule',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'module', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'canTransfer',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ModuleBound',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'module', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ModuleUnbound',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'module', type: 'address', indexed: true },
    ],
  },
] as const;

// ─── SecurityToken (per-token calls) ─────────────────────────────────────────

export const SECURITY_TOKEN_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'freezeWallet',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unfreezeWallet',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'forcedTransfer',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WalletFrozenSet',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'WalletUnfrozenSet',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ForcedTransferExecuted',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
] as const;

// ─── TokenFactory ─────────────────────────────────────────────────────────────

export const TOKEN_FACTORY_ABI = [
  {
    type: 'function',
    name: 'deployOffering',
    inputs: [
      { name: 'offeringId', type: 'bytes32' },
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'issuerAdmin', type: 'address' },
      { name: 'complianceAgent', type: 'address' },
      { name: 'initialSupply', type: 'uint256' },
      { name: 'initialRecipient', type: 'address' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'offerings',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'OfferingDeployed',
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

// ─── Settlement ───────────────────────────────────────────────────────────────

export const SETTLEMENT_ABI = [
  {
    type: 'function',
    name: 'executeMatch',
    inputs: [
      {
        name: 'buy',
        type: 'tuple',
        components: [
          { name: 'maker', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'side', type: 'uint8' },
          { name: 'qty', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
        ],
      },
      { name: 'buySig', type: 'bytes' },
      {
        name: 'sell',
        type: 'tuple',
        components: [
          { name: 'maker', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'paymentToken', type: 'address' },
          { name: 'side', type: 'uint8' },
          { name: 'qty', type: 'uint256' },
          { name: 'price', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
        ],
      },
      { name: 'sellSig', type: 'bytes' },
      { name: 'fillQty', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'feeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'filled',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancelled',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TradeExecuted',
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
  {
    type: 'event',
    name: 'OrderCancelled',
    inputs: [
      { name: 'orderHash', type: 'bytes32', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
    ],
  },
] as const;
