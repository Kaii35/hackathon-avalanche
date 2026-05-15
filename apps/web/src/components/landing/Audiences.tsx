import Link from 'next/link';
import { ArrowRight, Building2, Wallet, Check } from 'lucide-react';
import { Button } from '@hack/ui';

export function Audiences() {
  return (
    <section className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container grid gap-6 lg:grid-cols-2">
        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-8">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-400" />
            <span className="text-2xs font-medium uppercase tracking-wider text-brand-400">
              Para inversionistas
            </span>
          </div>
          <h3 className="text-2xl font-semibold tracking-tight">
            Liquidez para participaciones que antes no la tenían.
          </h3>
          <p className="mt-3 text-foreground-secondary">
            KYC reusable, portafolio en tiempo real, mercado secundario 24/7 con settlement atómico
            en USDC. Sin custodios, sin papeleo entre vendedor y comprador.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-foreground-secondary">
            {[
              'Compra y venta entre inversionistas calificados',
              'Settlement atómico vs USDC en una sola transacción',
              'Cap table on-chain auditable',
              'Cancela órdenes off-chain o on-chain según prefieras',
            ].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" />
                {b}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-8" size="lg">
            <Link href="/register">
              Crear mi cuenta
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
          />
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-8">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-info-fg" />
            <span className="text-2xs font-medium uppercase tracking-wider text-info-fg">
              Para IFCs
            </span>
          </div>
          <h3 className="text-2xl font-semibold tracking-tight">
            White-label de cumplimiento, mantienes tu marca y tu cap table.
          </h3>
          <p className="mt-3 text-foreground-secondary">
            Despliega cualquier oferta como un SecurityToken ERC-3643 con módulos de compliance
            configurables. Sin reescribir reglas regulatorias en cada contrato.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-foreground-secondary">
            {[
              'Configura supply, lockup, jurisdicciones y max holders en minutos',
              'Operaciones regulatorias: freeze, forced transfer, pause',
              'Audit log inmutable para CNBV',
              'Cobra fees configurables por trade en el secundario',
            ].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
                {b}
              </li>
            ))}
          </ul>
          <Button asChild variant="secondary" className="mt-8" size="lg">
            <Link href="/issuer/offerings/new">
              Crear oferta de prueba
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-info/10 blur-3xl"
          />
        </div>
      </div>
    </section>
  );
}
