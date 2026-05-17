// Dump completo de users + wallets + identity + balances on-chain
// para armar el cuadro de QA.

import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { prisma } from '@hack/database';

const RPC = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const ARKDEMO = '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26' as Address;
const USDC = '0x31E5aA694baebF0420170bD9b132F9b5c4b38A83' as Address;
const IR = '0x8Ca947A8c9714548eCe376a879D6755048018A82' as Address;

const ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isVerified',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'u', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

async function main() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    include: {
      wallets: { where: { isPrimary: true }, take: 1 },
      identities: { take: 1 },
    },
  });

  const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });

  console.log('\n=== USERS + WALLETS + BALANCES ===\n');
  for (const u of users) {
    const w = u.wallets[0]?.address ?? null;
    const ident = u.identities[0];

    let arkdemo = '—';
    let usdc = '—';
    let avax = '—';
    let kycOnChain: string | boolean = '—';
    if (w) {
      try {
        const wlower = w.toLowerCase() as Address;
        const [bArk, bUsdc, bAvax, kyc] = await Promise.all([
          client.readContract({
            address: ARKDEMO,
            abi: ABI,
            functionName: 'balanceOf',
            args: [wlower],
          }),
          client.readContract({
            address: USDC,
            abi: ABI,
            functionName: 'balanceOf',
            args: [wlower],
          }),
          client.getBalance({ address: wlower }),
          client.readContract({
            address: IR,
            abi: ABI,
            functionName: 'isVerified',
            args: [wlower],
          }),
        ]);
        arkdemo = (Number(bArk) / 1e18).toFixed(2);
        usdc = (Number(bUsdc) / 1e6).toFixed(2);
        avax = (Number(bAvax) / 1e18).toFixed(4);
        kycOnChain = kyc;
      } catch (e) {
        arkdemo = `(read failed)`;
      }
    }

    console.log(`${u.email.padEnd(35)} [${u.role}]`);
    console.log(`  wallet:     ${w ?? '(no linked)'}`);
    console.log(`  kyc DB:     ${ident?.kycStatus ?? '—'}`);
    console.log(`  kyc onchain:${kycOnChain}`);
    console.log(`  ARKDEMO:    ${arkdemo}`);
    console.log(`  USDC:       ${usdc}`);
    console.log(`  AVAX:       ${avax}`);
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
