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
} as const;
