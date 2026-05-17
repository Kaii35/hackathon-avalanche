// Resetea el password de un usuario a `Demo1234!` (el estándar del seed).
// Uso: pnpm exec dotenv -e .env -- pnpm exec tsx scripts/reset-password.ts <email>

import bcrypt from 'bcryptjs';
import { prisma } from '@hack/database';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: tsx reset-password.ts <email>');
    process.exit(1);
  }

  const NEW_PASSWORD = 'Demo1234!';
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  const updated = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
  });

  console.log(`Password reset OK para ${updated.email} (rol: ${updated.role})`);
  console.log(`Nuevo password: ${NEW_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
