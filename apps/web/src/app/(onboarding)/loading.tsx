/**
 * Onboarding route-level loading UI. Shown while the next step in the
 * wizard is streamed. Matches the (onboarding) layout chrome (gradient
 * mesh + container) so the transition feels continuous.
 */
export default function OnboardingLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-mesh opacity-70" />
      <div className="container flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-elevated/70" />
          <div className="h-4 w-12 animate-pulse rounded bg-elevated/60" />
        </header>
        <div className="mx-auto w-full max-w-3xl py-8">
          {/* Stepper placeholder */}
          <div className="mb-10 flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-1">
                <div className="h-2 animate-pulse rounded-full bg-elevated/60" />
              </div>
            ))}
          </div>
          {/* Card placeholder */}
          <div className="space-y-4 rounded-lg border border-border-subtle bg-elevated/40 p-8">
            <div className="h-6 w-2/3 animate-pulse rounded bg-elevated" />
            <div className="h-4 w-full animate-pulse rounded bg-elevated/70" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-elevated/70" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-elevated/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
