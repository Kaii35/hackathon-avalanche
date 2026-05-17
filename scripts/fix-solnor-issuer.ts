// Crea (idempotente) un Issuer entity para ajelandro.lopez y reasigna
// SOLNOR.issuerId para que la oferta refleje quién es su verdadero dueño.
// Esto cambia el subtítulo "<Issuer name> · Sector ..." en /investor/offerings/[id].

import { prisma } from '@hack/database';
import { createHash } from 'node:crypto';

function deterministicIssuerId(userId: string): string {
  const hash = createHash('sha256').update(`issuer:${userId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const SOLNOR_DB_ID = '81504844-cfbb-41be-a723-d2c3d7273b01';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'ajelandro.lopez@example.com' },
    include: { wallets: { where: { isPrimary: true }, take: 1 } },
  });
  if (!user) throw new Error('ajelandro user not found');

  // Si firstName/lastName están vacíos los seteo a algo razonable para que
  // el nombre del issuer luzca como persona/IFC en la UI.
  if (!user.firstName) {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstName: 'Alejandro', lastName: 'López' },
    });
    console.log('  user firstName/lastName actualizados → Alejandro López');
  }

  const issuerId = deterministicIssuerId(user.id);
  const walletAddress = (user.wallets[0]?.address ?? '').toLowerCase();

  // Upsert del Issuer entity. Le ponemos un nombre de empresa "real" para que
  // se vea como un IFC en el header, no solo el email del rep legal.
  const issuer = await prisma.issuer.upsert({
    where: { id: issuerId },
    create: {
      id: issuerId,
      name: 'EnergíaSolar Norte SAPI',
      cnbvLicense: 'CNBV-IFC-2024-0042',
      kycIssuerAddress: walletAddress,
    },
    update: {
      name: 'EnergíaSolar Norte SAPI',
      kycIssuerAddress: walletAddress,
    },
  });
  console.log(`  Issuer upserted: ${issuer.id}  name="${issuer.name}"`);

  // Reasignar SOLNOR a este issuer.
  const offering = await prisma.offering.findUnique({ where: { id: SOLNOR_DB_ID } });
  if (!offering) throw new Error('SOLNOR offering not found');

  await prisma.offering.update({
    where: { id: SOLNOR_DB_ID },
    data: { issuerId },
  });
  console.log(`  SOLNOR (${SOLNOR_DB_ID}) → issuerId ${issuerId}`);

  console.log('\nListo. Refresca /investor/offerings/<solnor-id> para ver el cambio.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
