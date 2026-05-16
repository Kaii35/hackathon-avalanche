'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SparklesCore } from '@/components/ui/sparkles';
import { GradientWaveText } from '@/components/ui/gradient-wave-text';

// useLayoutEffect warns on SSR (no DOM). Pick the SSR-safe variant so the
// build stays clean. On the client this is exactly useLayoutEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Landing-page welcome splash. Renders a fullscreen overlay with the Arca
 * wordmark animated by GradientWaveText, on top of an ambient dotted wave.
 *
 * Show rules (matches user request: "cada vez que se abra por primera vez
 * o se recargue desde la landing"):
 *   - HARD load of `/`  → show (visit + F5/reload)
 *   - SPA navigation back to `/` → don't show (it already played for this nav)
 *   - Browser back/forward to `/` → don't show (annoying)
 *
 * Detection uses Performance Navigation Timing API + a sessionStorage flag
 * keyed on `nav.startTime`, so a single navigation only triggers the splash
 * once even if the React tree remounts.
 */

// Brand-aligned gradient — keeps the welcome feeling cohesive with the
// rest of the product instead of using the library's warm-toned defaults.
const ARCA_WAVE_COLORS = [
  '#5C82FF', // brand light
  '#2A5BFF', // brand primary
  '#7B4FFF', // accent purple
  '#8FB3FF', // pale
  '#2A5BFF', // primary again (creates a wave-back effect)
  '#163399', // brand deep
];

// Single session-cookie used as the source of truth for "splash already
// played in this browser session". A session cookie (no Max-Age / Expires)
// clears when the browser tab/window closes. Crucially, it's readable from
// both the server (so SSR can skip rendering the pre-splash on F5 — no
// flash) and the client (so the splash JS knows not to mount again).
const SPLASH_PLAYED_COOKIE = 'arca-splash-played';
const SPLASH_VISIBLE_MS = 4000; // total time the splash holds before fading
const SPLASH_FADE_MS = 700; // fade-out duration

function hasSplashPlayedCookie(): boolean {
  if (typeof document === 'undefined') return false;
  // Format is simple `key=1`, so a substring check is enough and avoids
  // pulling in a cookie-parser dependency.
  return document.cookie.split('; ').includes(`${SPLASH_PLAYED_COOKIE}=1`);
}

function shouldShowSplash(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // If the cookie is set we've already shown the splash this session
    // (whether the user reloaded since or not). Don't show it again on F5.
    if (hasSplashPlayedCookie()) return false;

    // Even without the cookie, only on "hard" navigations: URL typed,
    // clicked from outside, or F5. Skip back/forward and prerender so the
    // splash doesn't ambush someone going through history.
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = entries[0];
    if (!nav) return false;
    return nav.type === 'navigate' || nav.type === 'reload';
  } catch {
    return false;
  }
}

function markSplashPlayed(): void {
  try {
    // Session cookie: no Max-Age/Expires, no Domain → scoped to this
    // browser session for the current origin. SameSite=Lax is the safe
    // default for first-party state.
    document.cookie = `${SPLASH_PLAYED_COOKIE}=1; path=/; SameSite=Lax`;
  } catch {
    /* ignore — cookies may be disabled */
  }
}

export function WelcomeSplash() {
  // Two-stage visibility: mounted (in DOM) + hiding (faded out). This lets
  // us play a fade transition before unmounting, instead of a hard cut.
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [hiding, setHiding] = useState(false);

  // SYNCHRONOUS hand-off with the server-rendered pre-splash cover. Runs
  // BEFORE the browser paints the first frame after hydration, so:
  //   - SPA nav: pre-splash is removed before the user ever sees it
  //   - Hard load: pre-splash stays under the animated splash, then we
  //     fade them out together at the end of the welcome
  useIsoLayoutEffect(() => {
    setMounted(true);
    const cover = document.getElementById('arca-pre-splash');

    if (!shouldShowSplash()) {
      // Not a hard load → the pre-splash shouldn't be visible at all.
      cover?.remove();
      return;
    }

    markSplashPlayed();
    setShow(true);

    // Lock page scroll while the splash is visible.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const fadeT = window.setTimeout(() => {
      setHiding(true);
      // Fade the pre-splash cover in lockstep with the animated splash so
      // the handoff to the landing is a single visual transition, not two
      // staggered ones.
      if (cover) {
        cover.style.transition = `opacity ${SPLASH_FADE_MS}ms ease-out`;
        cover.style.opacity = '0';
        cover.style.pointerEvents = 'none';
      }
    }, SPLASH_VISIBLE_MS);

    const hideT = window.setTimeout(() => {
      setShow(false);
      cover?.remove();
    }, SPLASH_VISIBLE_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(fadeT);
      window.clearTimeout(hideT);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Click-to-skip: respectful escape hatch for impatient users. Also fades
  // out the pre-splash cover so they don't get stuck on a black screen.
  const dismiss = () => {
    setHiding(true);
    const cover = document.getElementById('arca-pre-splash');
    if (cover) {
      cover.style.transition = `opacity ${SPLASH_FADE_MS}ms ease-out`;
      cover.style.opacity = '0';
      cover.style.pointerEvents = 'none';
    }
    window.setTimeout(() => {
      setShow(false);
      cover?.remove();
    }, SPLASH_FADE_MS);
  };

  // Render nothing on the server and on first paint — avoids hydration
  // mismatch and prevents the splash from flashing on SPA navigation.
  if (!mounted || !show) return null;

  // The splash is rendered through a portal directly into `document.body`.
  // Rationale: ancestors like RainbowKit / Framer Motion providers wrap the
  // tree in elements that set `transform` or `filter`, which create a new
  // containing block for fixed-positioned descendants — turning our
  // `position: fixed` into "absolute relative to that ancestor", and
  // breaking fullscreen coverage. Portaling to <body> sidesteps that.
  //
  // All critical positioning is in inline `style` (not Tailwind classes)
  // so it can't be lost to twMerge edge cases or class purging.
  const overlay = (
    <div
      role="dialog"
      aria-label="Bienvenido a Arca"
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647, // top of the stacking world
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: hiding ? 0 : 1,
        pointerEvents: hiding ? 'none' : 'auto',
        transition: `opacity ${SPLASH_FADE_MS}ms ease-out`,
      }}
    >
      {/* Sparkles backdrop — twinkling white particles via tsparticles.
          More reliable than a hand-rolled Three.js scene and only renders
          the canvas once the engine has initialised (handled by the
          component's `init` state). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <SparklesCore
          id="arca-splash-sparkles"
          background="transparent"
          minSize={0.6}
          maxSize={1.6}
          particleDensity={110}
          particleColor="#ffffff"
          speed={1.2}
          className="h-full w-full"
        />
      </div>

      {/* Soft radial vignette pushes the wordmark forward */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.9) 100%)',
        }}
      />

      {/* Content — ARCA + tagline. whitespace-nowrap keeps "ARCA" on a
          single horizontal line at every viewport size. */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(5rem, 16vw, 11rem)',
            fontWeight: 700,
            textTransform: 'uppercase',
            lineHeight: 1,
            letterSpacing: '0.18em',
            whiteSpace: 'nowrap',
            minHeight: '1.1em',
          }}
        >
          <GradientWaveText
            align="center"
            speed={1.6}
            delay={0.15}
            customColors={ARCA_WAVE_COLORS}
            ariaLabel="ARCA"
          >
            ARCA
          </GradientWaveText>
        </div>
      </div>

      {/* Skip hint */}
      <p
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 2,
          fontSize: '0.625rem',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'rgba(255, 255, 255, 0.3)',
          margin: 0,
        }}
      >
        clic para entrar
      </p>
    </div>
  );

  // Portal target is always document.body — we know it exists because we
  // gated rendering behind `mounted` (set in useEffect, client-side only).
  return createPortal(overlay, document.body);
}
