import { prisma } from '@hack/database';

async function main() {
  // Show all KYC records sorted by recency
  const records = await prisma.kycRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          wallets: { where: { isPrimary: true }, select: { address: true } },
          identities: { take: 1, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });

  console.log('\n=== KYC records (latest 15) ===');
  for (const r of records) {
    const u = r.user;
    const wallet = u.wallets[0]?.address ?? '— no wallet';
    const identityKyc = u.identities[0]?.kycStatus ?? '—';
    console.log(
      `${r.createdAt.toISOString()}  ${u.email.padEnd(30)}  role=${u.role}  ` +
        `KycRecord=${r.status.padEnd(9)}  Identity=${identityKyc.padEnd(9)}  ` +
        `wallet=${wallet}  ` +
        `provider=${r.provider}  externalId=${r.externalId ?? '—'}`,
    );
  }

  // Show audit log entries related to KYC + webhooks (last 20)
  console.log('\n=== Audit log: kyc + wallet (latest 20) ===');
  const audit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: 'kyc.' } },
        { action: { startsWith: 'wallet.' } },
        { action: { startsWith: 'identity.' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  for (const a of audit) {
    console.log(
      `${a.createdAt.toISOString()}  action=${a.action.padEnd(30)}  ` +
        `actor=${a.actor.slice(0, 36).padEnd(36)}  target=${a.target ?? '—'}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
