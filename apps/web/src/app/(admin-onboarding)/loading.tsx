/**
 * Loading UI for the admin post-register wallet-linking screen. Matches the
 * (admin-onboarding) layout so the transition is seamless.
 */
export default function AdminOnboardingLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-mesh opacity-70" />
      <div className="container flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-elevated/70" />
          <div className="h-4 w-12 animate-pulse rounded bg-elevated/60" />
        </header>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center py-8">
          <div className="w-full space-y-4 rounded-lg border border-border-subtle bg-elevated/40 p-8">
            <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-elevated/70" />
            <div className="mx-auto h-7 w-2/3 animate-pulse rounded bg-elevated" />
            <div className="mx-auto h-4 w-4/5 animate-pulse rounded bg-elevated/60" />
            <div className="h-20 animate-pulse rounded bg-elevated/50" />
            <div className="h-12 animate-pulse rounded bg-elevated/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
