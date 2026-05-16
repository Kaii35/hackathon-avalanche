'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

// Three.js + @react-three/fiber pulls in ~600KB gzipped. Dynamic-import with
// ssr:false so the shader never blocks the first paint of the form. The
// black background underneath is enough until the canvas fades in.
const CanvasRevealEffect = dynamic(
  () => import('./CanvasRevealEffect').then((m) => m.CanvasRevealEffect),
  { ssr: false, loading: () => null },
);

/**
 * Shared visual shell for /login and /register.
 *
 * - Fullscreen black background with white dot-matrix shader animation
 * - Brand logo top-left (links home)
 * - Centered content slot (form, chooser, etc.)
 * - Bottom vignette so the form copy stays legible over the shader
 *
 * The shader bg is intentionally ALWAYS DARK (not theme-aware) — auth pages
 * are an immersive moment, not part of the themed app surface.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black">
      {/* Shader background */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
          reverse={false}
        />
        {/* Radial vignette + top fade so the centered form sits cleanly */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      {/* Content layer */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex h-14 items-center px-6">
          <Link
            href="/"
            aria-label="Arca — inicio"
            className="rounded-md p-1 transition-opacity hover:opacity-80"
          >
            <Logo size={26} />
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
