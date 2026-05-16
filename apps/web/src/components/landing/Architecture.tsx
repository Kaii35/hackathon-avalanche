'use client';

import { useEffect, useState } from 'react';
import { Coins, Database, Layout, Server } from 'lucide-react';
import {
  RadialOrbitalTimeline,
  type OrbitalTimelineItem,
} from '@/components/ui/radial-orbital-timeline';

const layers: OrbitalTimelineItem[] = [
  {
    id: 1,
    title: 'Frontend',
    date: 'Next.js 15 · React 19',
    content:
      '~30 páginas en App Router (Investor / Issuer / Compliance Admin). wagmi v2 + RainbowKit (Core priorizada) con tema brand-tinted. SumsubWebSDK widget para KYC, SIWE-like wallet linking real, globo 3D Cobe en jurisdictions admin, logout con shader Three.js. Light/dark theme reactivo en todos los componentes.',
    category: 'UI',
    icon: Layout,
    relatedIds: [2],
    status: 'in-progress',
    energy: 92,
  },
  {
    id: 2,
    title: 'Backend',
    date: 'Node 20 + Next API',
    content:
      '24+ endpoints con auth JWT (jose), rate-limit Redis sliding window, RBAC, audit log inmutable. Integración Sumsub end-to-end (token, polling, webhook HMAC SHA256/512). Helper viem directo a IdentityRegistry bypaseando el SDK mock. Auto-reconcile batched de KycRecords pendientes con throttle in-process.',
    category: 'API',
    icon: Server,
    relatedIds: [1, 3, 4],
    status: 'in-progress',
    energy: 88,
  },
  {
    id: 3,
    title: 'Datos',
    date: 'Postgres · Redis · IPFS',
    content:
      'Prisma con 11 modelos (users, identities, wallets, kyc_records, offerings, cap_table, orders, trades, audit_log…) en Supabase. Upstash Redis Streams + BullMQ + sliding window rate limit. Indexer event-driven mantiene cap_table sincronizada. Pinata para prospectos IPFS pendiente.',
    category: 'DB',
    icon: Database,
    relatedIds: [2, 4],
    status: 'in-progress',
    energy: 90,
  },
  {
    id: 4,
    title: 'Avalanche L1',
    date: 'ERC-3643 · Fuji 43113',
    content:
      '7 contratos producción-ready y live en Fuji: IdentityRegistry, ComplianceManager, TokenFactory, Settlement, MockUSDC + 3 módulos (HoldingPeriod, MaxHolders, Jurisdiction). 141 tests Foundry verde. Demo flow end-to-end ejecutado on-chain (9 TXs verificables). DividendDistributor y Governance recién deployados. Pendiente: MaxInvestmentModule, ClaimIssuer, auditoría formal y subnet AvaCloud para prod.',
    category: 'Chain',
    icon: Coins,
    relatedIds: [2, 3],
    status: 'in-progress',
    energy: 78,
  },
];

export function Architecture() {
  const [radius, setRadius] = useState(200);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setRadius(130);
      else if (w < 768) setRadius(160);
      else if (w < 1024) setRadius(180);
      else setRadius(200);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <section id="arquitectura" className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container">
        <div className="mb-12 max-w-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">
            Arquitectura
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Cuatro capas, cero acoplamiento.
          </h2>
          <p className="mt-3 text-foreground-secondary">
            Cada capa puede evolucionar de forma independiente: subnet propia para producción,
            indexer reemplazable por The Graph, KYC provider intercambiable sin tocar contratos.
            Click en cualquier nodo para ver detalle y cómo se conecta con las demás.
          </p>
        </div>

        <RadialOrbitalTimeline
          timelineData={layers}
          radius={radius}
          className="h-[560px] sm:h-[640px] lg:h-[700px]"
        />

        <p className="mt-4 text-center text-2xs uppercase tracking-wider text-foreground-tertiary">
          Click en un nodo para expandir · Click fuera para reanudar la rotación
        </p>
      </div>
    </section>
  );
}
