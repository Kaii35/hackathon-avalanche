'use client';

import { Badge, Card, CardContent, EmptyState, PageHeader, Skeleton } from '@hack/ui';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  PauseCircle,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useActivity } from '@/lib/client/queries/portfolio';
import type { ActivityKind } from '@/lib/client/mocks/activity';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const meta: Record<
  ActivityKind,
  { icon: typeof Activity; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'brand' }
> = {
  kyc_verified: { icon: ShieldCheck, tone: 'success' },
  order_filled: { icon: CheckCircle2, tone: 'success' },
  order_created: { icon: ArrowUpRight, tone: 'info' },
  order_cancelled: { icon: XCircle, tone: 'neutral' },
  wallet_frozen: { icon: PauseCircle, tone: 'warning' },
  forced_transfer: { icon: ArrowDownLeft, tone: 'warning' },
  offering_active: { icon: Sparkles, tone: 'brand' },
  token_received: { icon: ArrowDownLeft, tone: 'success' },
};

export default function ActivityPage() {
  const { data, isLoading } = useActivity();

  return (
    <>
      <PageHeader
        title="Actividad"
        description="Línea de tiempo de eventos relevantes en tu cuenta."
      />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-5 w-5" />}
          title="Sin actividad reciente"
          description="Cuando tengas eventos aparecerán aquí."
        />
      ) : (
        <Card>
          <CardContent className="px-0 pt-0">
            <ul className="divide-y divide-border-subtle">
              {data.map((ev) => {
                const m = meta[ev.kind];
                const Icon = m.icon;
                return (
                  <li
                    key={ev.id}
                    className="grid grid-cols-[40px_1fr_140px] items-start gap-4 px-6 py-4"
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-full bg-elevated`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{ev.title}</span>
                        <Badge variant={m.tone} size="sm">
                          {ev.kind.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground-secondary">{ev.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-foreground-tertiary tabular">
                        {format(new Date(ev.ts), 'd MMM, HH:mm', { locale: es })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
