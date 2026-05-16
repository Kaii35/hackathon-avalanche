import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const JURISDICTION_MX = 484;
const DEMO_PASSWORD = 'Demo1234!';

function randHex(bytes: number): string {
  return '0x' + randomBytes(bytes).toString('hex');
}

function randAddress(): string {
  return ('0x' + randomBytes(20).toString('hex')).toLowerCase();
}

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Limpiando base de datos...');
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.order.deleteMany();
  await prisma.capTableEntry.deleteMany();
  await prisma.offering.deleteMany();
  await prisma.kycRecord.deleteMany();
  await prisma.identity.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.issuer.deleteMany();
  await prisma.processedEvent.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // eslint-disable-next-line no-console
  console.log('Creando issuer Arkangeles...');
  const issuer = await prisma.issuer.create({
    data: {
      name: 'Arkangeles',
      cnbvLicense: 'IFC-MX-0042',
      kycIssuerAddress: randAddress(),
      logoUrl: 'https://placehold.co/200x80?text=Arkangeles',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Creando admins...');
  const admins = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@arkangeles.mx',
        passwordHash,
        role: 'admin',
      },
    }),
    prisma.user.create({
      data: {
        email: 'compliance@arkangeles.mx',
        passwordHash,
        role: 'admin',
      },
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log('Creando inversionistas...');
  const investorSeeds = [
    { email: 'maria.lopez@example.mx', name: 'María López', accredited: true },
    { email: 'juan.perez@example.mx', name: 'Juan Pérez', accredited: true },
    { email: 'ana.garcia@example.mx', name: 'Ana García', accredited: false },
    { email: 'carlos.ramirez@example.mx', name: 'Carlos Ramírez', accredited: true },
    { email: 'sofia.hernandez@example.mx', name: 'Sofía Hernández', accredited: true },
    { email: 'diego.morales@example.mx', name: 'Diego Morales', accredited: false },
    { email: 'laura.vega@example.mx', name: 'Laura Vega', accredited: true },
    { email: 'pablo.cruz@example.mx', name: 'Pablo Cruz', accredited: true },
  ];

  const investors: Array<{
    user: { id: string; email: string };
    wallet: string;
    accredited: boolean;
  }> = [];

  for (const seed of investorSeeds) {
    const user = await prisma.user.create({
      data: {
        email: seed.email,
        passwordHash,
        role: 'investor',
      },
    });

    const wallet = randAddress();
    await prisma.wallet.create({
      data: { userId: user.id, address: wallet, isPrimary: true },
    });

    const verifiedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
    await prisma.identity.create({
      data: {
        userId: user.id,
        wallet,
        kycStatus: 'verified',
        jurisdiction: JURISDICTION_MX,
        accredited: seed.accredited,
        claimHash: randHex(32),
        verifiedAt,
      },
    });

    await prisma.kycRecord.create({
      data: {
        userId: user.id,
        provider: 'mock',
        externalId: `mock-${user.id}`,
        status: 'verified',
        verifiedAt,
        payload: {
          fullName: '[REDACTED]',
          rfc: '[REDACTED]',
          curp: '[REDACTED]',
          jurisdiction: JURISDICTION_MX,
        },
      },
    });

    investors.push({ user, wallet, accredited: seed.accredited });
  }

  // eslint-disable-next-line no-console
  console.log('Creando offering ARKDEMO (token real en Fuji)...');
  // ID estable para que el frontend lo enlace directamente.
  // Token verified en Avalanche Fuji: 0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26
  const ARKDEMO_ID = '00000000-0000-4000-8000-000000000001';
  const arkDemoOffering = await prisma.offering.create({
    data: {
      id: ARKDEMO_ID,
      issuerId: issuer.id,
      tokenAddress: '0x1C18933bDcFEDc048795cBd0aaEDD3D0e42F0C26',
      name: 'Arkangeles Demo Offering',
      symbol: 'ARKDEMO',
      sector: 'Venture Capital',
      description:
        'Participaciones tokenizadas de Arkangeles IFC sobre Avalanche Fuji. ' +
        'Token desplegado y verificado en Snowtrace. Solo para demo del hackathon.',
      prospectusIpfs: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      totalSupply: dec('100000'),
      pricePerUnit: dec('5.00'),
      lockupUntil: new Date('2025-01-01T00:00:00Z'), // lockup ya expirado para demo
      maxHolders: 500,
      allowedJurisdictions: [JURISDICTION_MX],
      status: 'active',
    },
  });
  // eslint-disable-next-line no-console
  console.log(`  ARKDEMO id: ${arkDemoOffering.id} | token: ${arkDemoOffering.tokenAddress}`);

  // eslint-disable-next-line no-console
  console.log('Creando ofertas...');
  const offeringSeeds = [
    {
      name: 'Cafetería La Roma',
      symbol: 'CAFROM',
      sector: 'Hospitalidad',
      description:
        'Cadena de cafeterías de especialidad con 4 sucursales en Roma Norte. Crecimiento promedio anual del 22%.',
      totalSupply: '100000',
      pricePerUnit: '120.50',
      maxHolders: 250,
    },
    {
      name: 'Logística MX Norte',
      symbol: 'LOGMX',
      sector: 'Logística',
      description:
        'Operador logístico last-mile con flota propia en Monterrey, Saltillo y Reynosa. Contratos vigentes con 3 retailers nacionales.',
      totalSupply: '500000',
      pricePerUnit: '85.00',
      maxHolders: 500,
    },
    {
      name: 'EnergíaSolar Norte',
      symbol: 'SOLNOR',
      sector: 'Energía renovable',
      description:
        'Granja solar de 12 MW en Sonora con PPA a 15 años con CFE. EBITDA proyectado de USD 2.4M anuales.',
      totalSupply: '250000',
      pricePerUnit: '210.75',
      maxHolders: 300,
    },
    {
      name: 'AgroPacífico',
      symbol: 'AGROP',
      sector: 'Agroindustria',
      description:
        'Productor y exportador de aguacate hass con 320 hectáreas certificadas en Michoacán. Cliente: cadenas en EE.UU. y Japón.',
      totalSupply: '180000',
      pricePerUnit: '155.00',
      maxHolders: 200,
    },
  ];

  const offerings: Array<{
    id: string;
    symbol: string;
    pricePerUnit: string;
    totalSupply: string;
  }> = [];
  for (const o of offeringSeeds) {
    const offering = await prisma.offering.create({
      data: {
        issuerId: issuer.id,
        tokenAddress: randAddress(),
        name: o.name,
        symbol: o.symbol,
        sector: o.sector,
        description: o.description,
        prospectusIpfs: 'bafy' + randomBytes(20).toString('hex'),
        totalSupply: dec(o.totalSupply),
        pricePerUnit: dec(o.pricePerUnit),
        lockupUntil: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        maxHolders: o.maxHolders,
        allowedJurisdictions: [JURISDICTION_MX],
        status: 'active',
      },
    });
    offerings.push({
      id: offering.id,
      symbol: offering.symbol,
      pricePerUnit: o.pricePerUnit,
      totalSupply: o.totalSupply,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Creando cap tables...');
  for (const offering of offerings) {
    const supply = Number(offering.totalSupply);
    let assignedPct = 0;
    const holderCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < holderCount && i < investors.length; i++) {
      const investor = investors[i];
      if (!investor) continue;
      const pct = i === holderCount - 1 ? 100 - assignedPct : Math.floor(Math.random() * 20) + 5;
      assignedPct += pct;
      const balance = (supply * pct) / 100;
      await prisma.capTableEntry.create({
        data: {
          offeringId: offering.id,
          wallet: investor.wallet,
          balance: dec(balance.toFixed(6)),
          percentOfTotal: dec(pct.toFixed(4)),
          lastUpdatedBlock: BigInt(1000 + i),
        },
      });
      if (assignedPct >= 100) break;
    }
  }

  // eslint-disable-next-line no-console
  console.log('Creando órdenes abiertas...');
  const orderRows: Array<{ id: string; offeringId: string; side: 'buy' | 'sell'; price: number }> =
    [];
  for (const offering of offerings) {
    const basePrice = Number(offering.pricePerUnit);
    const orderCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < orderCount; i++) {
      const investor = investors[Math.floor(Math.random() * investors.length)];
      if (!investor) continue;
      const side: 'buy' | 'sell' = i % 2 === 0 ? 'buy' : 'sell';
      const drift = (Math.random() - 0.5) * 0.06;
      const price = basePrice * (1 + drift);
      const qty = 100 + Math.floor(Math.random() * 900);
      const order = await prisma.order.create({
        data: {
          orderHash: randHex(32),
          makerWallet: investor.wallet,
          offeringId: offering.id,
          side,
          qty: dec(qty),
          price: dec(price.toFixed(2)),
          signature: randHex(65),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          status: 'open',
          salt: BigInt(Math.floor(Math.random() * 1e15)).toString(),
        },
      });
      orderRows.push({ id: order.id, offeringId: offering.id, side, price });
    }
  }

  // eslint-disable-next-line no-console
  console.log('Creando trades históricos...');
  for (let i = 0; i < 18; i++) {
    const offering = offerings[Math.floor(Math.random() * offerings.length)];
    if (!offering) continue;
    const buys = orderRows.filter((o) => o.offeringId === offering.id && o.side === 'buy');
    const sells = orderRows.filter((o) => o.offeringId === offering.id && o.side === 'sell');
    const buy = buys[Math.floor(Math.random() * buys.length)];
    const sell = sells[Math.floor(Math.random() * sells.length)];
    if (!buy || !sell) continue;
    const qty = 50 + Math.floor(Math.random() * 200);
    const price = (buy.price + sell.price) / 2;
    await prisma.trade.create({
      data: {
        buyOrderId: buy.id,
        sellOrderId: sell.id,
        offeringId: offering.id,
        qty: dec(qty),
        price: dec(price.toFixed(2)),
        txHash: randHex(32),
        blockNumber: BigInt(2000 + i),
        settledAt: new Date(Date.now() - 1000 * 60 * 60 * (i + 1)),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Creando audit log...');
  const adminEmail = admins[0]?.email ?? 'admin@arkangeles.mx';
  const auditEntries: Prisma.AuditLogCreateManyInput[] = [];
  for (const offering of offerings) {
    auditEntries.push({
      action: 'offering.deployed',
      actor: adminEmail,
      target: offering.id,
      payload: { symbol: offering.symbol },
      txHash: randHex(32),
    });
  }
  for (const inv of investors.slice(0, 3)) {
    auditEntries.push({
      action: 'identity.registered',
      actor: 'kyc-issuer',
      target: inv.wallet,
      payload: { jurisdiction: JURISDICTION_MX },
      txHash: randHex(32),
    });
  }
  auditEntries.push({
    action: 'wallet.frozen',
    actor: adminEmail,
    target: investors[7]?.wallet ?? randAddress(),
    payload: { reason: 'Revisión AML rutinaria' },
    txHash: randHex(32),
  });
  await prisma.auditLog.createMany({ data: auditEntries });

  // eslint-disable-next-line no-console
  console.log(`Listo. Password demo: ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(
    `Cuentas demo: ${[...admins.map((a) => a.email), ...investorSeeds.map((i) => i.email)].join(', ')}`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
