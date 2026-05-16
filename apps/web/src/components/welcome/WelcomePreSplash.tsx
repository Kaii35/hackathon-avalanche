import { cookies } from 'next/headers';

/**
 * Server-rendered "pre-splash" cover. Renders ONLY on the first visit per
 * browser session — checks the `arca-splash-played` session cookie that
 * WelcomeSplash sets after the animation runs. On subsequent reloads the
 * cookie is set, this returns null, and the landing renders straight away
 * with no flash.
 *
 * On the first visit (no cookie) we emit a solid black fullscreen panel
 * with the ARCA wordmark centered. It's plain HTML, present in the SSR'd
 * payload, so it paints BEFORE any JS executes — bridging the window
 * between "HTML painted" and "the animated WelcomeSplash JS chunk has
 * loaded and taken over". Without this cover the user briefly sees the
 * landing on slow connections before the animated splash appears.
 *
 * Removal flow when present:
 *   - Hard load (first visit) → WelcomeSplash mounts on top of this cover,
 *     animates, and fades both away together at the end of the 4s welcome,
 *     then sets the cookie so subsequent reloads skip this entirely.
 *   - SPA nav (rare — cookie should already be set) → WelcomeSplash's
 *     useLayoutEffect removes the cover synchronously before paint.
 *
 * All styles are inline so we don't depend on any Tailwind CSS chunk having
 * loaded yet (critical: this paints before stylesheets if they were ever
 * blocking).
 */
export async function WelcomePreSplash() {
  // Reading cookies opts this server component out of static rendering —
  // exactly what we want, since the cover's presence is per-request.
  const cookieStore = await cookies();
  const alreadyPlayed = cookieStore.get('arca-splash-played')?.value === '1';
  if (alreadyPlayed) return null;

  return (
    <div
      id="arca-pre-splash"
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        // Just below the animated splash so the splash renders cleanly on
        // top during the handoff. Both well above any app z-index.
        zIndex: 2147483646,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // No transition by default — JS adds one before fading us out.
      }}
    >
      <div
        style={{
          fontSize: 'clamp(5rem, 16vw, 11rem)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'rgba(255, 255, 255, 0.92)',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        ARCA
      </div>
    </div>
  );
}
