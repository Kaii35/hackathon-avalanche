import { prisma } from '@hack/database';

async function main() {
  const offerings = await prisma.offering.findMany({
    select: {
      id: true,
      name: true,
      symbol: true,
      tokenAddress: true,
      pricePerUnit: true,
      totalSupply: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\n=== ${offerings.length} ofertas en DB ===\n`);
  for (const o of offerings) {
    console.log(`${o.symbol.padEnd(10)} ${o.name}`);
    console.log(`  id:      ${o.id}`);
    console.log(`  token:   ${o.tokenAddress ?? '(null)'}`);
    console.log(`  price:   ${o.pricePerUnit}`);
    console.log(`  supply:  ${o.totalSupply}`);
    console.log(`  status:  ${o.status}`);
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
