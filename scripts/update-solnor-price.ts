// Reajusta SOLNOR a < 50 USDC + AÑADE nueva ventana de trades para mostrar la
// caída reciente en timeline. APPEND-ONLY: no borra órdenes ni trades viejos.
// Los datos históricos quedan intactos como contexto de mercado.
//
// La caída se inserta como un evento de "corrección de precio" en los últimos
// 14 días: 16 trades nuevos que van de ~$210 a $42.50. El más reciente
// (settledAt = now) es el que el header lee como `lastTradePrice`.
//
// Run: pnpm exec tsx scripts/update-solnor-price.ts
// (carga .env por sí solo — no requiere dotenv-cli)

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// Cargar .env del repo root ANTES de importar Prisma — Prisma lee DATABASE_URL
// al inicializar el cliente. Este script se invoca desde subworkspaces donde
// `process.cwd()` no apunta al repo root, así que resolvemos por path absoluto.
// __dirname está disponible aquí porque tsx emite CJS por defecto.
loadDotenv({ path: resolve(__dirname, '..', '.env') });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma, Prisma } = require('@hack/database') as typeof import('@hack/database');

if (process.env.NODE_ENV === 'production') {
  console.error('[demo-script] Refusing to run with NODE_ENV=production.');
  process.exit(1);
}

const SOLNOR_DB_ID = '81504844-cfbb-41be-a723-d2c3d7273b01';
const TARGET_PRICE = '42.50';
const START_PRICE = 210.75; // precio "previo" — coincide con getHistoricalStartPrice('SOLNOR')

function randHex(bytes: number): string {
  return '0x' + randomBytes(bytes).toString('hex');
}

function dec(v: number | string): Prisma.Decimal {
  return new Prisma.Decimal(typeof v === 'number' ? v.toFixed(8) : v);
}

async function main() {
  const offering = await prisma.offering.findUnique({ where: { id: SOLNOR_DB_ID } });
  if (!offering) {
    console.error(`[error] SOLNOR offering (${SOLNOR_DB_ID}) no existe. Ejecuta el seed primero.`);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 1) Bajar pricePerUnit en la tabla Offering.
  // -------------------------------------------------------------------------
  const previousPrice = offering.pricePerUnit.toString();
  if (previousPrice !== TARGET_PRICE) {
    await prisma.offering.update({
      where: { id: SOLNOR_DB_ID },
      data: { pricePerUnit: dec(TARGET_PRICE) },
    });
    console.log(`[ok] Offering.pricePerUnit: ${previousPrice} → ${TARGET_PRICE} USDC`);
  } else {
    console.log(`[skip] Offering.pricePerUnit ya está en ${TARGET_PRICE} USDC`);
  }

  // -------------------------------------------------------------------------
  // 2) APPEND-ONLY: no se borra nada. Las órdenes y trades históricos de SOLNOR
  //    permanecen como contexto de mercado. Solo añadimos un nuevo bloque de
  //    trades en los últimos 14 días para representar la corrección de precio.
  // -------------------------------------------------------------------------
  const existingTrades = await prisma.trade.count({ where: { offeringId: SOLNOR_DB_ID } });
  const existingOrders = await prisma.order.count({ where: { offeringId: SOLNOR_DB_ID } });
  console.log(
    `[info] Historial actual preservado: ${existingTrades} trades + ${existingOrders} orders de SOLNOR`,
  );

  // Si el script ya corrió antes y el último trade ya está a TARGET_PRICE,
  // salimos para no acumular ruido en cada re-ejecución.
  const lastTrade = await prisma.trade.findFirst({
    where: { offeringId: SOLNOR_DB_ID },
    orderBy: { settledAt: 'desc' },
  });
  if (lastTrade && Number(lastTrade.price) === Number(TARGET_PRICE)) {
    console.log(
      `[skip] El último trade ya está en ${TARGET_PRICE} USDC — no se añade ventana nueva.`,
    );
    console.log(`     · Si quieres una ventana adicional, borra esta guarda y vuelve a correr.`);
    return;
  }

  // -------------------------------------------------------------------------
  // 3) Tomar 2 wallets KYC'eadas para asignar como maker de buy/sell orders.
  //    Cualquier wallet sirve — solo se usa como FK; los datos importantes son
  //    los precios/qty de los trades.
  // -------------------------------------------------------------------------
  const wallets = await prisma.wallet.findMany({
    where: { isPrimary: true },
    take: 4,
    orderBy: { linkedAt: 'asc' },
  });
  if (wallets.length < 2) {
    console.error('[error] Necesito al menos 2 wallets primarias en DB para crear órdenes.');
    process.exit(1);
  }
  const [walletA, walletB] = wallets;
  if (!walletA || !walletB) throw new Error('unreachable');

  // -------------------------------------------------------------------------
  // 4) Generar 14 trades — uno por día — con precio escalonado en caída.
  //    Cada trade tiene su propia orden buy + sell con `status = 'filled'`.
  //    Curva: $210 → $42.50 con ruido leve para que parezca orgánica.
  // -------------------------------------------------------------------------
  const days = 14;
  const trades: Array<{ daysAgo: number; price: number; qty: number }> = [];
  const easing = (t: number) => 1 - Math.pow(1 - t, 2); // ease-out cuadrático — caída más fuerte al inicio
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1); // 0 → 1
    const eased = easing(t);
    const base = START_PRICE - (START_PRICE - Number(TARGET_PRICE)) * eased;
    // Ruido ±3%
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 0.015;
    const price = Math.max(Number(TARGET_PRICE), base * (1 + noise));
    const qty = 60 + Math.floor((Math.sin(i * 2.1) + 1) * 80); // 60–220 SOLNOR/trade
    trades.push({ daysAgo: days - 1 - i, price, qty });
  }
  // Forzamos que el último trade (settledAt = now) cierre EXACTAMENTE en TARGET_PRICE
  // → ese es el `lastTradePrice` que verá el header.
  if (trades[trades.length - 1]) {
    trades[trades.length - 1]!.daysAgo = 0;
    trades[trades.length - 1]!.price = Number(TARGET_PRICE);
  }
  // Y duplicamos 2 trades más en las últimas 24h para que el volumen 24h se vea.
  trades.push({ daysAgo: 0.6, price: Number(TARGET_PRICE) * 1.02, qty: 145 });
  trades.push({ daysAgo: 0.2, price: Number(TARGET_PRICE) * 0.97, qty: 92 });
  // Re-sort by recency descending (más antiguo primero para que el último insert sea "now")
  trades.sort((a, b) => b.daysAgo - a.daysAgo);

  // Crear órdenes + trades en secuencia.
  const dayMs = 24 * 60 * 60 * 1000;
  let created = 0;
  for (const t of trades) {
    const settledAt = new Date(Date.now() - t.daysAgo * dayMs);
    const expiresAt = new Date(settledAt.getTime() + 7 * dayMs);

    const buyOrder = await prisma.order.create({
      data: {
        orderHash: randHex(32),
        makerWallet: walletA.address,
        offeringId: SOLNOR_DB_ID,
        side: 'buy',
        qty: dec(t.qty),
        price: dec(t.price.toFixed(4)),
        filledQty: dec(t.qty),
        signature: randHex(65),
        expiresAt,
        status: 'filled',
        salt: BigInt(Math.floor(Math.random() * 1e15)).toString(),
        createdAt: settledAt,
      },
    });

    const sellOrder = await prisma.order.create({
      data: {
        orderHash: randHex(32),
        makerWallet: walletB.address,
        offeringId: SOLNOR_DB_ID,
        side: 'sell',
        qty: dec(t.qty),
        price: dec(t.price.toFixed(4)),
        filledQty: dec(t.qty),
        signature: randHex(65),
        expiresAt,
        status: 'filled',
        salt: BigInt(Math.floor(Math.random() * 1e15)).toString(),
        createdAt: settledAt,
      },
    });

    await prisma.trade.create({
      data: {
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        offeringId: SOLNOR_DB_ID,
        qty: dec(t.qty),
        price: dec(t.price.toFixed(4)),
        txHash: randHex(32),
        blockNumber: BigInt(2000000 + created),
        settledAt,
      },
    });
    created++;
  }

  console.log(`[ok] Añadidos ${created} trades nuevos (append-only).`);
  console.log(`     · Curva: ${START_PRICE} → ${TARGET_PRICE} USDC en 14 días`);
  console.log(`     · lastTradePrice (más reciente) = ${TARGET_PRICE} USDC`);
  console.log(`     · 3 trades en las últimas 24h → volumen 24h visible`);
  console.log(
    `     · Historial previo intacto: ${existingTrades} trades + ${existingOrders} orders.`,
  );
  console.log(`     · Refresca la página de SOLNOR para verlo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
