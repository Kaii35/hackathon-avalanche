/**
 * Route-level loading UI shown the instant the user clicks a link to ANY
 * (app) route — admin, issuer or investor — while Next.js streams the
 * real RSC payload. Without this file, the browser blocks on the
 * server-side `requireSession()` round-trip and the previous page stays
 * frozen, which feels like "the click didn't register".
 *
 * Keep it lightweight (no heavy components, no shaders) — its whole job is
 * to be visible immediately. The skeleton mimics the dashboard chrome so
 * the transition lands gracefully when content arrives.
 */
export default function AppRouteLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder (matches md+ width) */}
      <div className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-border-subtle bg-surface/40 backdrop-blur-sm md:flex">
        <div className="flex h-14 items-center border-b border-border-subtle px-3">
          <div className="h-6 w-20 animate-pulse rounded bg-elevated" />
        </div>
        <div className="flex-1 space-y-2 px-3 py-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-full animate-pulse rounded bg-elevated/70" />
          ))}
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar placeholder */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border-subtle bg-canvas/80 px-4 backdrop-blur-md md:px-6">
          <div className="h-9 max-w-md flex-1 animate-pulse rounded-md bg-elevated/60" />
          <div className="ml-auto h-8 w-32 animate-pulse rounded-md bg-elevated/60" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-elevated/60" />
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {/* Page header placeholder */}
          <div className="mb-6 space-y-2">
            <div className="h-7 w-56 animate-pulse rounded bg-elevated" />
            <div className="h-4 w-80 animate-pulse rounded bg-elevated/60" />
          </div>

          {/* Stat grid placeholder */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg border border-border-subtle bg-elevated/40"
              />
            ))}
          </div>

          {/* Content block placeholder */}
          <div className="mt-6 h-72 animate-pulse rounded-lg border border-border-subtle bg-elevated/40" />
        </main>
      </div>
    </div>
  );
}
