// Lee las órdenes en DB para alice y bob por wallet address.
import { prisma } from '@hack/database';

const WALLETS = [
  { name: 'alice', addr: '0x08115fa8e747f1524c32ce1b26b71a8b64b408d9' },
  { name: 'bob', addr: '0x1ea61078e0479dc83121144a284dd79f5483b6fd' },
];

async function main() {
  for (const w of WALLETS) {
    const orders = await prisma.order.findMany({
      where: { makerWallet: w.addr },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`\n${w.name} (${w.addr}) — ${orders.length} orden(es):`);
    for (const o of orders) {
      console.log(
        `  ${o.side.padEnd(4)} qty=${o.qty.toString()} price=${o.price.toString()}  status=${o.status}  hash=${o.orderHash.slice(0, 12)}...`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
