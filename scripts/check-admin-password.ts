// Verifica el hash del password de admin@arkangeles.mx y prueba el match.
import bcrypt from 'bcryptjs';
import { prisma } from '@hack/database';

async function main() {
  const email = process.argv[2] ?? 'admin@arkangeles.mx';
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log(`User ${email} NO EXISTE en DB`);
    return;
  }

  console.log('User encontrado:');
  console.log(`  email:        ${user.email}`);
  console.log(`  role:         ${user.role}`);
  console.log(`  passwordHash: ${user.passwordHash.slice(0, 30)}...`);
  console.log(`  hash length:  ${user.passwordHash.length} (bcrypt típico = 60)`);

  const testPasswords = ['Demo1234!', 'demo1234!', 'Demo1234', 'admin', 'Admin1234!'];
  for (const pw of testPasswords) {
    const match = await bcrypt.compare(pw, user.passwordHash);
    console.log(`  bcrypt.compare("${pw}") → ${match}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
