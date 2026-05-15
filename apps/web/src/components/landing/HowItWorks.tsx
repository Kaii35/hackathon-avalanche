'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    title: 'Identidad on-chain',
    description:
      'Inversionistas pasan KYC una sola vez. La IFC emite un claim firmado y registra la wallet en IdentityRegistry. Reusable entre todas las ofertas.',
    illustration: (
      <svg viewBox="0 0 200 120" className="h-32 w-full">
        <defs>
          <linearGradient id="il1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E84142" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#E84142" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="40"
          y="20"
          width="120"
          height="80"
          rx="10"
          fill="url(#il1)"
          stroke="#E84142"
          strokeOpacity="0.4"
        />
        <circle cx="100" cy="50" r="14" fill="none" stroke="#E84142" strokeWidth="1.5" />
        <path d="M85 80 Q100 65 115 80" fill="none" stroke="#E84142" strokeWidth="1.5" />
        <text
          x="100"
          y="105"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
        >
          0xa1b2…f9c4
        </text>
      </svg>
    ),
  },
  {
    title: 'Emisión tokenizada',
    description:
      'La IFC publica una oferta vía TokenFactory: define supply, lockup, jurisdicciones y máximo de holders. El prospecto se ancla a IPFS.',
    illustration: (
      <svg viewBox="0 0 200 120" className="h-32 w-full">
        <defs>
          <linearGradient id="il2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="20"
          y="30"
          width="50"
          height="60"
          rx="6"
          fill="url(#il2)"
          stroke="#10B981"
          strokeOpacity="0.5"
        />
        <rect
          x="75"
          y="30"
          width="50"
          height="60"
          rx="6"
          fill="url(#il2)"
          stroke="#10B981"
          strokeOpacity="0.5"
        />
        <rect
          x="130"
          y="30"
          width="50"
          height="60"
          rx="6"
          fill="url(#il2)"
          stroke="#10B981"
          strokeOpacity="0.5"
        />
        <line x1="65" y1="60" x2="80" y2="60" stroke="#10B981" />
        <line x1="120" y1="60" x2="135" y2="60" stroke="#10B981" />
        <text
          x="100"
          y="110"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
        >
          ERC-3643
        </text>
      </svg>
    ),
  },
  {
    title: 'Mercado secundario',
    description:
      'Inversionistas firman órdenes EIP-712 off-chain. El matching engine cruza, y Settlement.sol ejecuta atomicamente con verificación de compliance.',
    illustration: (
      <svg viewBox="0 0 200 120" className="h-32 w-full">
        <defs>
          <linearGradient id="il3a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="il3b" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={`b${i}`}
            x={20 + i * 18}
            y={60 - i * 4}
            width="14"
            height={45 + i * 4}
            fill="url(#il3a)"
            stroke="#3B82F6"
            strokeOpacity="0.3"
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={`a${i}`}
            x={120 + i * 18}
            y={20}
            width="14"
            height={40 - i * 4}
            fill="url(#il3b)"
            stroke="#EF4444"
            strokeOpacity="0.3"
          />
        ))}
        <line
          x1="100"
          y1="0"
          x2="100"
          y2="120"
          stroke="#94a3b8"
          strokeDasharray="3 3"
          strokeOpacity="0.3"
        />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="producto" className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container">
        <div className="mb-14 max-w-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">
            Cómo funciona
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Tres capas, una infraestructura.
          </h2>
          <p className="mt-3 text-foreground-secondary">
            De la identidad regulada al settlement atómico. Cada paso ocurre on-chain con
            verificación CNBV en cada transferencia.
          </p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border-subtle md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-surface p-6"
            >
              <span className="font-mono text-2xs text-foreground-tertiary">0{i + 1}</span>
              <div className="mt-3">{step.illustration}</div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-foreground-secondary">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
