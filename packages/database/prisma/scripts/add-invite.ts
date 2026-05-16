// One-off script to pre-approve an admin email without re-seeding the DB.
// Usage: pnpm --filter @hack/database exec tsx prisma/scripts/add-invite.ts <email> [note]
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: tsx prisma/scripts/add-invite.ts <email> [note]');
    process.exit(1);
  }
  const note = process.argv[3] ?? null;

  // Pick the most recent admin as inviter so the invite is properly attributed.
  const inviter = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
  });

  const existing = await prisma.adminInvite.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === 'pending') {
      console.log(`✓ Invitación pendiente ya existe para ${email} (id=${existing.id})`);
    } else if (existing.status === 'revoked') {
      // Re-activate revoked invite
      const updated = await prisma.adminInvite.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          note: note ?? existing.note,
          invitedById: inviter?.id ?? existing.invitedById,
        },
      });
      console.log(`✓ Invitación revocada re-activada para ${email} (id=${updated.id})`);
    } else {
      console.log(`✗ Invitación ya fue consumida por ${email}. No se puede re-emitir.`);
    }
    return;
  }

  const created = await prisma.adminInvite.create({
    data: {
      email,
      note,
      invitedById: inviter?.id ?? null,
      status: 'pending',
    },
  });
  console.log(`✓ Invitación creada para ${email} (id=${created.id})`);
  if (inviter) console.log(`  Inviter: ${inviter.email}`);
  else console.log('  Sin inviter (no hay admin en la DB todavía)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
