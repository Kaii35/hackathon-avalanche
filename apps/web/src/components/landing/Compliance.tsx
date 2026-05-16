import type { ReactNode } from 'react';
import { FileText, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '@hack/ui';

interface BentoItem {
  title: string;
  description: string;
  icon: ReactNode;
  status?: string;
  tags?: string[];
  meta?: string;
  cta?: string;
  colSpan?: 1 | 2;
  hasPersistentHover?: boolean;
}

const items: BentoItem[] = [
  {
    title: 'Compliance en cada transferencia',
    meta: '_update gate',
    description:
      'Toda transferencia consulta ComplianceRegistry: jurisdicción, lockup, max holders, accreditation. Si falla, la tx revierte atómicamente.',
    icon: <ShieldCheck className="size-4 text-brand" />,
    status: 'On-chain',
    tags: ['ERC-3643', 'Modular', 'Atomic'],
    colSpan: 2,
    hasPersistentHover: true,
    cta: 'Ver módulos →',
  },
  {
    title: 'KYC reusable',
    meta: '1 wallet · N ofertas',
    description:
      'Una sola verificación por inversionista, válida en todas las ofertas y portable entre IFCs vía claims firmadas.',
    icon: <UserCheck className="size-4 text-success" />,
    status: 'Verified',
    tags: ['Identity', 'Portable'],
  },
  {
    title: 'Operaciones regulatorias',
    meta: 'AGENT_ROLE',
    description:
      'Freeze por orden judicial, forced transfer por recovery de claves, pause de emergencia. Requisitos CNBV, no opcionales.',
    icon: <Lock className="size-4 text-warning" />,
    status: 'Auditable',
    tags: ['Freeze', 'Forced', 'Pause'],
    colSpan: 2,
  },
  {
    title: 'Audit log inmutable',
    meta: 'append-only',
    description:
      'Cada acción admin queda firmada off-chain y emitida on-chain. Cumple Disposiciones de Carácter General.',
    icon: <FileText className="size-4 text-accent-cyan" />,
    status: 'Live',
    tags: ['CNBV', 'Trace'],
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

        <BentoGrid items={items} />
      </div>
    </section>
  );
}

function BentoGrid({ items }: { items: BentoItem[] }) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-4 transition-all duration-300',
            'will-change-transform hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:hover:shadow-[0_2px_24px_rgba(42,91,255,0.12)]',
            item.colSpan === 2 ? 'md:col-span-2' : 'col-span-1',
            item.hasPersistentHover && [
              '-translate-y-0.5 border-border shadow-md',
              'dark:shadow-[0_2px_24px_rgba(42,91,255,0.12)]',
            ],
          )}
        >
          {/* Dotted pattern overlay — visible on hover (or always for the highlighted card) */}
          <div
            className={cn(
              'absolute inset-0 transition-opacity duration-300',
              item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--text-tertiary)/0.15)_1px,transparent_1px)] bg-[length:4px_4px]" />
          </div>

          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg bg-elevated transition-all duration-300',
                  'group-hover:bg-brand/10',
                  item.hasPersistentHover && 'bg-brand/10',
                )}
              >
                {item.icon}
              </div>
              <span
                className={cn(
                  'rounded-lg px-2 py-1 text-xs font-medium backdrop-blur-sm transition-colors duration-300',
                  'bg-elevated text-foreground-secondary',
                  'group-hover:bg-overlay',
                  item.hasPersistentHover && 'bg-overlay',
                )}
              >
                {item.status || 'Active'}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-medium tracking-tight text-foreground">
                {item.title}
                {item.meta && (
                  <span className="ml-2 font-mono text-xs font-normal text-foreground-tertiary">
                    {item.meta}
                  </span>
                )}
              </h3>
              <p className="text-sm font-[425] leading-snug text-foreground-secondary">
                {item.description}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground-tertiary">
                {item.tags?.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-elevated px-2 py-1 backdrop-blur-sm transition-all duration-200 hover:bg-overlay"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="text-xs text-foreground-tertiary opacity-0 transition-opacity group-hover:opacity-100">
                {item.cta || 'Explorar →'}
              </span>
            </div>
          </div>

          {/* Subtle gradient frame — same opacity treatment as the dotted overlay */}
          <div
            className={cn(
              'pointer-events-none absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-transparent via-brand/10 to-transparent p-px transition-opacity duration-300',
              item.hasPersistentHover ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          />
        </div>
      ))}
    </div>
  );
}
