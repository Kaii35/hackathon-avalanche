'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only mount point for the WelcomeSplash. Lives in its own file so
 * the landing page.tsx can stay a Server Component while still benefiting
 * from `ssr: false` + lazy-loading (Next 15 forbids `ssr: false` inside
 * Server Components).
 *
 * Splash uses Three.js (~600KB) — deferring keeps the landing's critical
 * path lean since the splash only matters for the first ~2.5s of a hard load.
 */
const WelcomeSplash = dynamic(() => import('./WelcomeSplash').then((m) => m.WelcomeSplash), {
  ssr: false,
  loading: () => null,
});

export function WelcomeSplashMount() {
  return <WelcomeSplash />;
}
