// Quick script: link alice → maria.lopez and bob → juan.perez so the
// investor UI can sign orders with the wallets that already have KYC,
// AVAX gas, USDC, ARKDEMO and Settlement approvals on Fuji.
//
// Run: pnpm exec dotenv -e .env -- pnpm exec tsx scripts/link-demo-wallets.ts
//
// Safe to re-run — uses upsert + idempotent updates.

import { prisma } from '@hack/database';

// Hardcoded demo addresses mutate users by email. If executed against a
// production DATABASE_URL it would silently overwrite real KYC wallets.
if (process.env.NODE_ENV === 'production') {
  console.error('[demo-script] Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

// Lowercase porque el Zod addressSchema en packages/shared transforma a
// lowercase antes de comparar en Prisma. Match exact requiere mismo casing.
const LINKS = [
  {
    email: 'maria.lopez@example.mx',
    wallet: '0x08115fa8e747f1524c32ce1b26b71a8b64b408d9',
    label: 'alice (seller)',
  },
  {
    email: 'juan.perez@example.mx',
    wallet: '0x1ea61078e0479dc83121144a284dd79f5483b6fd',
    label: 'bob (buyer)',
  },
  {
    email: 'admin@arkangeles.mx',
    wallet: '0x66cb45ee3646759179901567fa81fe2eba639278',
    label: 'deployer (admin + issuer en chain)',
  },
];

async function main() {
  for (const link of LINKS) {
    const user = await prisma.user.findUnique({ where: { email: link.email } });
    if (!user) {
      console.error(`  [skip] user ${link.email} not found`);
      continue;
    }

    // Update primary wallet
    const primary = await prisma.wallet.findFirst({
      where: { userId: user.id, isPrimary: true },
    });
    if (primary) {
      await prisma.wallet.update({
        where: { id: primary.id },
        data: { address: link.wallet },
      });
    } else {
      await prisma.wallet.create({
        data: { userId: user.id, address: link.wallet, isPrimary: true },
      });
    }

    // Update identity row to match (the seed creates one with the old address)
    const identity = await prisma.identity.findFirst({ where: { userId: user.id } });
    if (identity) {
      await prisma.identity.update({
        where: { id: identity.id },
        data: { wallet: link.wallet },
      });
    }

    console.log(`  [ok]   ${link.email} → ${link.wallet}  (${link.label})`);
  }

  console.log('Listo. Logout/login en la UI para refrescar la session.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
