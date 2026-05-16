/**
 * Deployed contract addresses on Avalanche Fuji (chain 43113).
 * Read from NEXT_PUBLIC_* env vars — null when running SSR without env.
 */

function addr(key: string): `0x${string}` | null {
  const v = process.env[key];
  if (!v || !v.startsWith('0x')) return null;
  return v as `0x${string}`;
}

export const CONTRACT_ADDRESSES = {
  identityRegistry: addr('NEXT_PUBLIC_IDENTITY_REGISTRY'),
  complianceRegistry: addr('NEXT_PUBLIC_COMPLIANCE_REGISTRY'),
  tokenFactory: addr('NEXT_PUBLIC_TOKEN_FACTORY'),
  usdc: addr('NEXT_PUBLIC_USDC'),
  settlement: addr('NEXT_PUBLIC_SETTLEMENT'),
  dividendDistributor: addr('NEXT_PUBLIC_DIVIDEND_DISTRIBUTOR'),
} as const;

/** Demo SecurityToken deployed by the seed script on Fuji. */
export const FUJI_DEMO_TOKEN = '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26' as `0x${string}`;

/**
 * Minimal ABIs — only the view selectors used by frontend hooks.
 * Never import the full compiled JSON; keep this file lightweight.
 */
export const ABI = {
  identityRegistry: [
    {
      name: 'isVerified',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'bool' }],
    },
  ] as const,

  erc20: [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'symbol',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
    },
    {
      name: 'decimals',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }],
    },
    {
      name: 'name',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'string' }],
    },
  ] as const,

  dividendDistributor: [
    {
      name: 'declare',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'token', type: 'address' },
        { name: 'paymentToken', type: 'address' },
        { name: 'holders', type: 'address[]' },
        { name: 'amounts', type: 'uint256[]' },
      ],
      outputs: [{ name: 'dividendId', type: 'uint256' }],
    },
    {
      name: 'claim',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'dividendId', type: 'uint256' }],
      outputs: [],
    },
    {
      name: 'claimable',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'dividendId', type: 'uint256' },
        { name: 'holder', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'dividends',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: '', type: 'uint256' }],
      outputs: [
        { name: 'token', type: 'address' },
        { name: 'paymentToken', type: 'address' },
        { name: 'declaredBy', type: 'address' },
        { name: 'totalAmount', type: 'uint256' },
        { name: 'totalClaimed', type: 'uint256' },
        { name: 'declaredAt', type: 'uint256' },
        { name: 'holderCount', type: 'uint256' },
      ],
    },
    {
      name: 'allocation',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'dividendId', type: 'uint256' },
        { name: 'holder', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'claimed',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'dividendId', type: 'uint256' },
        { name: 'holder', type: 'address' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      name: 'nextDividendId',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'DividendDeclared',
      type: 'event',
      inputs: [
        { name: 'dividendId', type: 'uint256', indexed: true },
        { name: 'token', type: 'address', indexed: true },
        { name: 'paymentToken', type: 'address', indexed: true },
        { name: 'declaredBy', type: 'address', indexed: false },
        { name: 'totalAmount', type: 'uint256', indexed: false },
        { name: 'holderCount', type: 'uint256', indexed: false },
      ],
    },
    {
      name: 'DividendClaimed',
      type: 'event',
      inputs: [
        { name: 'dividendId', type: 'uint256', indexed: true },
        { name: 'holder', type: 'address', indexed: true },
        { name: 'amount', type: 'uint256', indexed: false },
      ],
    },
  ] as const,

  // Write + allowance selectors — kept separate so view-only callers stay unchanged.
  erc20Approve: [
    {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const,
} as const;
