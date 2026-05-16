import { prisma } from '@hack/database';

const TARGET = '0xA24f1A1afb5ca441554633b750923e6E6Eef7DD9'.toLowerCase();

async function main() {
  // 1) Direct wallet lookup
  const wallet = await prisma.wallet.findUnique({
    where: { address: TARGET },
    include: {
      user: { select: { id: true, email: true, role: true, firstName: true, lastName: true } },
    },
  });

  console.log('\n=== Wallet table ===');
  if (!wallet) {
    console.log(`NOT FOUND: ${TARGET}`);
  } else {
    console.log(JSON.stringify(wallet, null, 2));
  }

  // 2) All wallets for the user (if found above) OR list everything
  if (wallet) {
    const allForUser = await prisma.wallet.findMany({
      where: { userId: wallet.userId },
      orderBy: { linkedAt: 'desc' },
    });
    console.log('\n=== All wallets for that user ===');
    console.log(JSON.stringify(allForUser, null, 2));
  } else {
    // Maybe the user exists but never linked the wallet — try by email
    console.log('\n=== Recent wallets in DB (last 10) ===');
    const recent = await prisma.wallet.findMany({
      orderBy: { linkedAt: 'desc' },
      take: 10,
      include: { user: { select: { email: true, role: true } } },
    });
    console.log(JSON.stringify(recent, null, 2));

    console.log('\n=== Users with no wallets (last 5) ===');
    const orphans = await prisma.user.findMany({
      where: { wallets: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, email: true, role: true, createdAt: true },
    });
    console.log(JSON.stringify(orphans, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
