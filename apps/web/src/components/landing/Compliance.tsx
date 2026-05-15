import { FileText, Lock, ShieldCheck, Users } from 'lucide-react';

const features = [
  {
    icon: ShieldCheck,
    title: 'Compliance en cada transferencia',
    body: 'Todo movimiento de tokens consulta ComplianceRegistry: jurisdicción, lockup, max holders, accreditation. Si falla, la tx revierte.',
  },
  {
    icon: Users,
    title: 'KYC reusable',
    body: 'Una sola verificación por inversionista, válida en todas las ofertas. Identidad on-chain con claims firmados por la IFC.',
  },
  {
    icon: Lock,
    title: 'Operaciones regulatorias',
    body: 'Freeze por orden judicial, forced transfer por recovery de claves, pause de emergencia. Requisitos CNBV, no opcionales.',
  },
  {
    icon: FileText,
    title: 'Audit log inmutable',
    body: 'Cada acción admin queda registrada off-chain firmada y on-chain con eventos. Cumple Disposiciones de Carácter General.',
  },
];

export function Compliance() {
  return (
    <section id="compliance" className="border-b border-border-subtle py-20 lg:py-28">
      <div className="container">
        <div className="mb-14 max-w-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">
            Ventajas regulatorias
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            CNBV-first, no CNBV-after.
          </h2>
          <p className="mt-3 text-foreground-secondary">
            Las reglas regulatorias mexicanas viven en los contratos, no en una capa de aplicación
            que se pueda esquivar. Audit log nativo, retención por jurisdicción y operaciones de
            excepción auditables.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border-subtle bg-surface p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-brand-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-foreground-secondary">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
