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
      'Investor Portal, Issuer Portal y Compliance Admin sobre App Router con server components por default. wagmi v2 + RainbowKit (Core Wallet, MetaMask, Rabby), Tailwind + shadcn/ui, Framer Motion para transiciones.',
    category: 'UI',
    icon: Layout,
    relatedIds: [2],
    status: 'in-progress',
    energy: 85,
  },
  {
    id: 2,
    title: 'Backend',
    date: 'Node 20 + Next API',
    content:
      'KYC Orchestrator, Order Matching, BullMQ workers y Notifications. Servicios + repositorios + DTOs Zod + middleware (auth JWT con jose, rate-limit Redis, error mapper). Eventos firmados EIP-712 antes de tocar settlement.',
    category: 'API',
    icon: Server,
    relatedIds: [1, 3, 4],
    status: 'in-progress',
    energy: 80,
  },
  {
    id: 3,
    title: 'Datos',
    date: 'Postgres · Redis · IPFS',
    content:
      'Prisma con 11 modelos (users, identities, offerings, cap_table, orders, trades, audit_log…). Supabase para Postgres, Upstash para Redis Streams + BullMQ, Pinata para prospectos. Indexer mantiene cap_table sincronizada con eventos on-chain.',
    category: 'DB',
    icon: Database,
    relatedIds: [2, 4],
    status: 'completed',
    energy: 95,
  },
  {
    id: 4,
    title: 'Avalanche L1',
    date: 'ERC-3643 · T-REX',
    content:
      'IdentityRegistry, ComplianceRegistry + módulos (HoldingPeriod, MaxHolders, Jurisdiction, MaxInvestment), SecurityToken, TokenFactory, Settlement y Escrow. Subnet propia para producción; modo mock corre la misma SDK con event bus en Redis hasta deployar.',
    category: 'Chain',
    icon: Coins,
    relatedIds: [2, 3],
    status: 'pending',
    energy: 25,
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
