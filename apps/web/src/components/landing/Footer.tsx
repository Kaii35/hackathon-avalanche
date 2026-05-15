import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface/30">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,_1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-xs font-bold text-white">
                ▲
              </span>
              <span className="font-semibold tracking-tight">Mercado IFC</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-foreground-secondary">
              Mercado secundario regulado de participaciones IFC sobre Avalanche. White-label para
              Instituciones de Financiamiento Colectivo en México.
            </p>
            <p className="mt-4 text-xs text-foreground-tertiary">
              Demo · Avalanche Fuji · No constituye oferta pública de valores.
            </p>
          </div>
          <FooterCol
            title="Producto"
            items={[
              { label: 'Investor Portal', href: '/investor' },
              { label: 'Issuer Portal', href: '/issuer' },
              { label: 'Compliance Admin', href: '/admin' },
              { label: 'Docs', href: '#producto' },
            ]}
          />
          <FooterCol
            title="Recursos"
            items={[
              { label: 'Arquitectura', href: '#arquitectura' },
              { label: 'Compliance', href: '#compliance' },
              { label: 'FAQ', href: '#faq' },
            ]}
          />
          <FooterCol
            title="Legal"
            items={[
              { label: 'Términos', href: '#' },
              { label: 'Privacidad', href: '#' },
              { label: 'Aviso CNBV', href: '#' },
            ]}
          />
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 text-xs text-foreground-tertiary sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Mercado IFC · Demo Hackathon Avalanche</p>
          <p>Construido con Next.js, Solidity y mucho café.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm text-foreground-secondary">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} className="hover:text-foreground transition-colors">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
