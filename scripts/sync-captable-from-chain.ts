// Sincroniza cap_table_entries con los balances on-chain de los SecurityTokens
// deployados. Patch temporal hasta que el indexer real escuche Transfer events
// y mantenga la tabla en tiempo real.
//
// Run: pnpm exec dotenv -e .env -- pnpm exec tsx scripts/sync-captable-from-chain.ts

import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { prisma, Prisma } from '@hack/database';

if (process.env.NODE_ENV === 'production') {
  console.error('[demo-script] Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const RPC = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';

// Cada token que el demo necesita reflejar en cap_table_entries.
const TOKENS: Array<{ token: Address; offeringId: string; label: string }> = [
  {
    token: '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26',
    offeringId: '00000000-0000-4000-8000-000000000001',
    label: 'ARKDEMO',
  },
  {
    token: '0x791fC7021b2A8c8619F7daf980c26809Db90B6Dc',
    offeringId: '81504844-cfbb-41be-a723-d2c3d7273b01',
    label: 'SOLNOR',
  },
];

const WALLETS: Address[] = [
  '0x66Cb45eE3646759179901567Fa81Fe2EBa639278', // deployer
  '0x08115fA8e747f1524C32cE1B26B71A8b64B408d9', // alice / maria.lopez
  '0x1EA61078e0479Dc83121144A284DD79f5483b6fd', // bob / diego.morales
  '0x3A1D811afAcacea8e205Fcb3C8a70E628d096FF2', // ajelandro (issuer SOLNOR)
];

const ERC20_BALANCE_OF = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

async function main() {
  const client = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });

  for (const { token, offeringId, label } of TOKENS) {
    const offering = await prisma.offering.findUnique({ where: { id: offeringId } });
    if (!offering) {
      console.error(`  [skip] offering ${offeringId} (${label}) no existe en DB`);
      continue;
    }

    // Borrar entradas viejas (random del seed) — vamos a re-poblar con balances reales.
    await prisma.capTableEntry.deleteMany({ where: { offeringId } });

    const totalSupply = Number(offering.totalSupply);
    console.log(`\nSync ${label} (${token}) → offeringId=${offeringId}`);

    for (const wallet of WALLETS) {
      const raw = await client.readContract({
        address: token,
        abi: ERC20_BALANCE_OF,
        functionName: 'balanceOf',
        args: [wallet],
      });

      const pretty = Number(raw) / 1e18;
      if (pretty === 0) continue; // skipear holders sin balance

      const balance = new Prisma.Decimal(pretty.toString());
      const pct = totalSupply > 0 ? (pretty / totalSupply) * 100 : 0;
      const lower = wallet.toLowerCase();

      await prisma.capTableEntry.create({
        data: {
          offeringId,
          wallet: lower,
          balance,
          percentOfTotal: new Prisma.Decimal(pct.toFixed(6)),
          lastUpdatedBlock: BigInt(0),
        },
      });

      console.log(
        `  [ok] ${wallet} → ${pretty.toLocaleString('en-US')} ${label} (${pct.toFixed(2)}%)`,
      );
    }
  }

  console.log('\nListo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
