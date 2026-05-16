'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Badge, Button } from '@hack/ui';
import { ArtificialHeroBackground } from '@/components/ui/artificial-hero';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border-subtle">
      {/* Animated cosmic background — rotating ASCII orb + film grain in Arkangeles blue */}
      <ArtificialHeroBackground />
      {/* Readability vignette: dark in dark mode, light wash in light mode so the
          headline always sits comfortably over the busy canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,rgba(247,249,251,0.35)_0%,rgba(247,249,251,0.55)_55%,rgba(247,249,251,0.85)_100%)] dark:[background:radial-gradient(ellipse_at_center,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.65)_55%,rgba(0,0,0,0.92)_100%)]"
      />
      {/* Bottom fade into next section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-canvas"
      />
      {/* Brand seam at top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent"
      />
      <div className="container relative z-10 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.21, 1.02, 0.73, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge variant="outline" className="mb-6">
            <ShieldCheck className="h-3 w-3" />
            Compliance CNBV embebido en smart contracts · Avalanche Fuji
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="gradient-text-brand">El mercado secundario</span>
            <br />
            de participaciones IFC en México.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-foreground-secondary sm:text-lg">
            Tokeniza, distribuye y opera participaciones reguladas con liquidez 24/7. ERC-3643 sobre
            Avalanche, identidad on-chain, settlement atómico y audit log inmutable. Para
            Instituciones de Financiamiento Colectivo y sus inversionistas.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="shadow-glow-brand">
              <Link href="/register">
                Empezar como inversionista
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/issuer">Soy una IFC</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-foreground-tertiary">
            Demo ejecutándose en Avalanche Fuji · Datos sintéticos · No constituye oferta pública
          </p>
        </motion.div>

        {/* Floating stack visualization */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative mx-auto mt-16 max-w-4xl"
          aria-hidden
        >
          <div className="relative rounded-2xl border border-border-subtle bg-elevated/60 p-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-disabled/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-disabled/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground-disabled/40" />
              </div>
              <span className="text-xs text-foreground-tertiary tabular">arca.mx/investor</span>
              <span className="text-xs text-foreground-tertiary">●</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Capital tokenizado" value="$284.5M" delta="+12.4%" />
              <MiniMetric label="Volumen 30d" value="$18.7M" delta="+8.1%" />
              <MiniMetric label="Inversionistas" value="1,284" delta="+5.6%" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniOrderbook />
              <MiniChart />
            </div>
          </div>
          {/* Glow underneath */}
          <div className="absolute inset-x-12 -bottom-6 h-24 bg-brand/30 blur-3xl" />
        </motion.div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface/60 p-3">
      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
      <p className="text-xs text-success-fg tabular">{delta}</p>
    </div>
  );
}

function MiniOrderbook() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface/60 p-3">
      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">
        Libro de órdenes · AKAPYM
      </p>
      <div className="mt-2 space-y-0.5 text-xs font-mono">
        {[
          { p: '102.80', q: '1,200', tone: 'danger' as const },
          { p: '102.60', q: '850', tone: 'danger' as const },
          { p: '102.40', q: '2,100', tone: 'danger' as const },
          { p: '102.20', q: '1,800', tone: 'success' as const },
          { p: '102.00', q: '950', tone: 'success' as const },
          { p: '101.80', q: '1,400', tone: 'success' as const },
        ].map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 tabular">
            <span className={l.tone === 'danger' ? 'text-danger-fg' : 'text-success-fg'}>
              {l.p}
            </span>
            <span className="text-right text-foreground-secondary">{l.q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniChart() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface/60 p-3">
      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">Portfolio · 30d</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular">$2,654,510</span>
        <span className="text-xs text-success-fg tabular">+4.2%</span>
      </div>
      <svg viewBox="0 0 200 60" className="mt-2 h-16 w-full">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A5BFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2A5BFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points="0,42 18,38 36,40 54,32 72,34 90,28 108,30 126,22 144,18 162,14 180,8 200,12"
          fill="none"
          stroke="#2A5BFF"
          strokeWidth="1.5"
        />
        <polygon
          points="0,42 18,38 36,40 54,32 72,34 90,28 108,30 126,22 144,18 162,14 180,8 200,12 200,60 0,60"
          fill="url(#chartGrad)"
        />
      </svg>
    </div>
  );
}
