'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@hack/ui';
import { CheckCircle2, ArrowRight, Briefcase, Store, Activity } from 'lucide-react';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';

export default function CompletePage() {
  const reset = useOnboardingStore((s) => s.reset);

  return (
    <Card className="text-center">
      <CardContent className="space-y-6 py-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-bg text-success-fg shadow-glow-soft">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">¡Bienvenido al mercado!</h1>
          <p className="text-foreground-secondary">
            Tu cuenta está activa, tu KYC firmado y tu wallet registrada. Ya puedes invertir en
            cualquier oferta disponible.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-left">
          <Quick href="/investor" icon={<Briefcase className="h-4 w-4" />} title="Mi portafolio" />
          <Quick
            href="/investor/offerings"
            icon={<Store className="h-4 w-4" />}
            title="Marketplace"
          />
          <Quick
            href="/investor/activity"
            icon={<Activity className="h-4 w-4" />}
            title="Actividad"
          />
        </div>
        <Button asChild size="lg" onClick={() => reset()}>
          <Link href="/investor">
            Ir a mi cuenta
            <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Quick({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
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
