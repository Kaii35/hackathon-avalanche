export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">IFC Secondary Market</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Mercado secundario regulado de participaciones IFC sobre Avalanche.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <a href="/investor" className="rounded-lg border p-6 hover:border-brand">
          <h2 className="font-semibold">Investor Portal</h2>
          <p className="mt-2 text-sm text-neutral-600">KYC, portfolio y trading.</p>
        </a>
        <a href="/issuer" className="rounded-lg border p-6 hover:border-brand">
          <h2 className="font-semibold">Issuer Portal</h2>
          <p className="mt-2 text-sm text-neutral-600">Emisión y cap table.</p>
        </a>
        <a href="/admin" className="rounded-lg border p-6 hover:border-brand">
          <h2 className="font-semibold">Compliance Admin</h2>
          <p className="mt-2 text-sm text-neutral-600">Whitelist y operaciones regulatorias.</p>
        </a>
      </div>
    </main>
  );
}
