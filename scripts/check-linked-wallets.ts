// Verifica el estado actual de los wallets linkeados a usuarios demo.
import { prisma } from '@hack/database';

const EMAILS = ['maria.lopez@example.mx', 'juan.perez@example.mx'];

async function main() {
  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { wallets: true, identities: true },
    });
    if (!user) {
      console.log(`  [missing] ${email}`);
      continue;
    }
    console.log(`\n${email} (userId=${user.id})`);
    for (const w of user.wallets) {
      console.log(`  wallet  primary=${w.isPrimary}  address="${w.address}"`);
    }
    for (const i of user.identities) {
      console.log(`  identity wallet="${i.wallet}"  kyc=${i.kycStatus}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
