'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

// The shader is decorative — defer its Three.js bundle so the splash text
// (greeting + spinner) shows immediately, with the shader fading in over it.
const ShaderAnimation = dynamic(
  () => import('@/components/ui/shader-animation').then((m) => m.ShaderAnimation),
  { ssr: false, loading: () => null },
);

interface Props {
  /** Greeting line, e.g. "Bienvenido, Miguel" */
  greeting?: string;
  /** Sub-line, e.g. "Preparando tu dashboard…" */
  subtitle?: string;
  /** Bottom footnote next to the spinner. Defaults to chain status. */
  footnote?: string;
  /** Accessible label for the overlay (screen readers). */
  ariaLabel?: string;
}

export function DashboardLoadingScreen({
  greeting = 'Bienvenido',
  subtitle = 'Preparando tu dashboard…',
  footnote = 'Conectando con Avalanche Fuji…',
  ariaLabel = 'Cargando dashboard',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <ShaderAnimation />

      {/* Vignette + radial gradient to focus the eye on the centered text */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center px-6">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-2.5"
        >
          <LogoMark size={36} glow />
          <span className="text-lg font-semibold uppercase tracking-[0.18em] text-white">ARCA</span>
        </motion.div>

        <motion.div
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
          className="space-y-1.5 max-w-md"
        >
          <h1 className="text-4xl font-semibold tracking-tighter text-white sm:text-5xl">
            {greeting}
          </h1>
          <p className="text-sm text-white/70">{subtitle}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-2 flex items-center gap-2 text-xs text-white/60"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{footnote}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
