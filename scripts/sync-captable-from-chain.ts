// Sincroniza cap_table_entries con los balances on-chain de ARKDEMO en Fuji.
// Patch temporal hasta que el indexer escuche los Transfer events reales
// (ahora ya lo hace — ver apps/indexer/src/fuji/watcher.ts). Mantenido como
// emergency-rebuild si la DB pierde estado y el indexer no puede backfillear.
//
// Run: pnpm exec dotenv -e .env -- pnpm exec tsx scripts/sync-captable-from-chain.ts

import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { prisma, Prisma } from '@hack/database';

// Hardcoded demo wallets; refuse to run against a production DATABASE_URL.
if (process.env.NODE_ENV === 'production') {
  console.error('[demo-script] Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const RPC = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const ARKDEMO_TOKEN = '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26' as Address;
const ARKDEMO_OFFERING_ID = '00000000-0000-4000-8000-000000000001';

// Wallets to mirror (the demo actors that hold ARKDEMO). When the real indexer
// is wired, this list goes away and every Transfer event updates the table.
const WALLETS: Address[] = [
  '0x66Cb45eE3646759179901567Fa81Fe2EBa639278', // deployer
  '0x08115fA8e747f1524C32cE1B26B71A8b64B408d9', // alice
  '0x1EA61078e0479Dc83121144A284DD79f5483b6fd', // bob
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
  const offering = await prisma.offering.findUnique({ where: { id: ARKDEMO_OFFERING_ID } });
  if (!offering) {
    console.error(`Offering ${ARKDEMO_OFFERING_ID} no existe en DB. Corre el seed primero.`);
    process.exit(1);
  }

  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(RPC),
  });

  console.log(`Sincronizando ${WALLETS.length} wallets contra ARKDEMO (${ARKDEMO_TOKEN})...`);

  for (const wallet of WALLETS) {
    const raw = await client.readContract({
      address: ARKDEMO_TOKEN,
      abi: ERC20_BALANCE_OF,
      functionName: 'balanceOf',
      args: [wallet],
    });

    // SecurityToken has 18 decimals — convert to whole-unit balance for the cap_table.
    const pretty = Number(raw) / 1e18;
    const balance = new Prisma.Decimal(pretty.toString());
    const lower = wallet.toLowerCase();

    await prisma.capTableEntry.upsert({
      where: {
        offeringId_wallet: { offeringId: ARKDEMO_OFFERING_ID, wallet: lower },
      },
      create: {
        offeringId: ARKDEMO_OFFERING_ID,
        wallet: lower,
        balance,
        lastUpdatedBlock: BigInt(0),
      },
      update: {
        balance,
      },
    });

    console.log(`  [ok] ${wallet} → ${pretty} ARKDEMO`);
  }

  console.log('\nListo. Refresca /investor o /investor/portfolio para ver tu posición.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
