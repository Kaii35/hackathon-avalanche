export function StatsStrip() {
  const items = [
    { label: 'Capital tokenizado', value: '$284.5M', sub: 'MXN equivalente' },
    { label: 'Ofertas activas', value: '12', sub: '+3 este trimestre' },
    { label: 'Inversionistas verificados', value: '1,284', sub: 'KYC on-chain' },
    { label: 'Volumen secundario 30d', value: '$18.7M', sub: 'USDC liquidado' },
  ];
  return (
    <section className="border-b border-border-subtle bg-surface/30">
      <div className="container grid grid-cols-2 gap-px overflow-hidden lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="bg-canvas p-6">
            <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
              {it.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular">{it.value}</p>
            <p className="mt-1 text-xs text-foreground-tertiary">{it.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
