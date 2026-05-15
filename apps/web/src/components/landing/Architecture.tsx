'use client';

import { motion } from 'framer-motion';

const layers = [
  {
    title: 'Frontend',
    items: ['Investor Portal', 'Issuer Portal', 'Compliance Admin'],
    color: '#E84142',
  },
  {
    title: 'Backend',
    items: ['KYC Orchestrator', 'Order Matching', 'Indexer', 'Notifications'],
    color: '#8B5CF6',
  },
  {
    title: 'Datos',
    items: ['Postgres', 'Redis cache', 'IPFS / Pinata'],
    color: '#06B6D4',
  },
  {
    title: 'Avalanche Subnet',
    items: [
      'IdentityRegistry',
      'ComplianceRegistry',
      'SecurityToken (ERC-3643)',
      'Settlement + Escrow',
    ],
    color: '#10B981',
  },
];

export function Architecture() {
  return (
    <section id="arquitectura" className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container">
        <div className="mb-14 max-w-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">
            Arquitectura
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Cuatro capas, cero acoplamiento.
          </h2>
          <p className="mt-3 text-foreground-secondary">
            Cada capa puede evolucionar de forma independiente: subnet propia para producción,
            indexer reemplazable por The Graph, KYC provider intercambiable sin tocar contratos.
          </p>
        </div>
        <div className="space-y-3">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-5"
            >
              <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: layer.color, boxShadow: `0 0 12px ${layer.color}80` }}
                  />
                  <span className="text-sm font-semibold tracking-tight">{layer.title}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {layer.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-border-subtle bg-elevated px-2.5 py-1 text-xs text-foreground-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-full w-1/3 opacity-50"
                style={{
                  background: `radial-gradient(circle at 100% 50%, ${layer.color}22 0%, transparent 60%)`,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
