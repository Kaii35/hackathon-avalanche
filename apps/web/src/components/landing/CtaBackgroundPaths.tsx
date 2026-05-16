'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const TITLE = 'Empieza ahora.';

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d:
      `M-${380 - i * 5 * position} -${189 + i * 6}` +
      `C-${380 - i * 5 * position} -${189 + i * 6} ` +
      `-${312 - i * 5 * position} ${216 - i * 6} ` +
      `${152 - i * 5 * position} ${343 - i * 6}` +
      `C${616 - i * 5 * position} ${470 - i * 6} ` +
      `${684 - i * 5 * position} ${875 - i * 6} ` +
      `${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg
        className="h-full w-full text-brand-700/55 dark:text-white/35"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export function CtaBackgroundPaths() {
  const words = TITLE.split(' ');

  return (
    <section
      id="cta"
      className="relative flex w-full items-center justify-center overflow-hidden border-b border-border-subtle bg-canvas py-28 lg:py-36"
    >
      {/* SVG paths layer */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* Radial brand wash sits above the paths but below content for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-radial from-brand/10 via-transparent to-transparent dark:from-brand/15"
      />

      <div className="container relative z-10 mx-auto px-4 text-center md:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 1.2 }}
          className="mx-auto max-w-4xl"
        >
          <h2 className="mb-10 text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl">
            {words.map((word, wordIndex) => (
              <span key={wordIndex} className="mr-4 inline-block last:mr-0">
                {word.split('').map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 80, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: 'spring',
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block bg-gradient-to-br from-foreground via-foreground to-brand bg-clip-text text-transparent dark:to-brand-300"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h2>

          {/* Glass-pill CTA */}
          <div className="group relative inline-block overflow-hidden rounded-2xl bg-gradient-to-b from-brand/40 via-brand/15 to-transparent p-px shadow-glow-soft backdrop-blur-lg transition-shadow duration-300 hover:shadow-glow-brand">
            <Link
              href="/register"
              className="relative flex items-center gap-3 rounded-[1.05rem] bg-surface/95 px-9 py-5 text-base font-semibold text-foreground backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:bg-overlay/90 dark:hover:bg-overlay sm:text-lg"
            >
              <span className="opacity-95 transition-opacity group-hover:opacity-100">
                Empezar ahora
              </span>
              <ArrowRight className="size-4 text-brand transition-transform duration-300 group-hover:translate-x-1.5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
