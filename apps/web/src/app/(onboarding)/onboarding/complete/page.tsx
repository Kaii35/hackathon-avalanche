'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@hack/ui';
import {
  Activity,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  PieChart,
  PlusCircle,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { SessionUser } from '@hack/shared';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';
import { useSession } from '@/lib/client/queries/session';

type Role = SessionUser['role'];

function landingFor(role: Role | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'issuer') return '/issuer';
  return '/investor';
}

interface RoleConfig {
  copy: string;
  cta: string;
  quickLinks: Array<{ href: string; icon: ReactNode; title: string }>;
}

function configFor(role: Role | undefined): RoleConfig {
  if (role === 'issuer') {
    return {
      copy: 'Tu cuenta de emisor está activa. Ya puedes emitir tu primera oferta y administrar tu cap table on-chain.',
      cta: 'Ir al portal de emisor',
      quickLinks: [
        { href: '/issuer', icon: <Building2 className="h-4 w-4" />, title: 'Mi panel' },
        {
          href: '/issuer/offerings',
          icon: <Briefcase className="h-4 w-4" />,
          title: 'Mis ofertas',
        },
        {
          href: '/issuer/offerings/new',
          icon: <PlusCircle className="h-4 w-4" />,
          title: 'Crear oferta',
        },
      ],
    };
  }
  if (role === 'admin') {
    return {
      copy: 'Tu cuenta de administrador está activa. Compliance, audit log y operaciones regulatorias en un solo lugar.',
      cta: 'Ir al panel admin',
      quickLinks: [
        { href: '/admin', icon: <ShieldCheck className="h-4 w-4" />, title: 'Compliance' },
        { href: '/admin/investors', icon: <Users className="h-4 w-4" />, title: 'Inversionistas' },
        { href: '/admin/audit-log', icon: <Activity className="h-4 w-4" />, title: 'Audit log' },
      ],
    };
  }
  // default → investor
  return {
    copy: 'Tu cuenta está activa, tu KYC firmado y tu wallet registrada. Ya puedes invertir en cualquier oferta disponible.',
    cta: 'Ir a mi cuenta',
    quickLinks: [
      { href: '/investor', icon: <PieChart className="h-4 w-4" />, title: 'Mi portafolio' },
      { href: '/investor/offerings', icon: <Store className="h-4 w-4" />, title: 'Marketplace' },
      { href: '/investor/activity', icon: <Activity className="h-4 w-4" />, title: 'Actividad' },
    ],
  };
}

export default function CompletePage() {
  const reset = useOnboardingStore((s) => s.reset);
  const { data: session } = useSession();
  const role = session?.role;
  const config = configFor(role);
  const target = landingFor(role);

  return (
    <Card className="text-center">
      <CardContent className="space-y-6 py-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-bg text-success-fg shadow-glow-soft">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">¡Bienvenido al mercado!</h1>
          <p className="text-foreground-secondary">{config.copy}</p>
        </div>
        <div className="grid gap-3 text-left sm:grid-cols-3">
          {config.quickLinks.map((q) => (
            <Quick key={q.href} href={q.href} icon={q.icon} title={q.title} />
          ))}
        </div>
        <Button asChild size="lg" onClick={() => reset()}>
          <Link href={target}>
            {config.cta}
            <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Quick({ href, icon, title }: { href: string; icon: ReactNode; title: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-elevated p-4 text-sm text-foreground transition-colors hover:border-border-strong"
    >
      <span className="text-foreground-tertiary">{icon}</span>
      {title}
    </Link>
  );
}
