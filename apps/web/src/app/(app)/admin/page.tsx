'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartCard,
  MetricGrid,
  PageHeader,
  StatCard,
} from '@hack/ui';
import { AlertTriangle, FileLock2, ShieldCheck, Snowflake, Users } from 'lucide-react';
import { useInvestors, useAuditLog } from '@/lib/client/queries/admin';
import { AreaTrend } from '@/components/charts/AreaTrend';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
  const { data: investors } = useInvestors();
  const { data: audit } = useAuditLog();

  const pendingKyc = (investors ?? []).filter((i) => i.kycStatus === 'pending').length;
  const frozen = (investors ?? []).filter((i) => i.frozen).length;

  const volume = Array.from({ length: 60 }).map((_, i) => ({
    ts: new Date(Date.now() - (59 - i) * 86400000).toISOString(),
    value: 60_000 + Math.sin(i / 4) * 14_000 + i * 1500,
  }));

  return (
    <>
      <PageHeader
        title="Compliance Admin"
        description="Operaciones regulatorias, audit trail y vigilancia de la plataforma."
        meta={
          <Badge variant="success">
            <ShieldCheck className="h-3 w-3" />
            Audit log sincronizado
          </Badge>
        }
      />

      <MetricGrid>
        <StatCard
          label="KYCs pendientes"
          value={pendingKyc}
          helper="Requieren revisión"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Wallets congeladas"
          value={frozen}
          helper="Activas hoy"
          icon={<Snowflake className="h-4 w-4" />}
        />
        <StatCard
          label="Alertas abiertas"
          value="2"
          helper="Volumen anómalo"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Tx settled 30d"
          value="1,432"
          delta={6.4}
          icon={<FileLock2 className="h-4 w-4" />}
        />
      </MetricGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          title="Volumen plataforma"
          helper="USDC liquidado · 60 días"
          className="lg:col-span-2"
        >
          <AreaTrend data={volume} color="#3B82F6" yLabel="USDC" />
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Audit log reciente</CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <ul className="divide-y divide-border-subtle">
              {(audit ?? []).slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="mt-1 grid h-7 w-7 place-items-center rounded-full bg-elevated text-foreground-tertiary">
                    <FileLock2 className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.action.replace(/_/g, ' ')}</p>
                    <p className="truncate text-2xs text-foreground-tertiary">
                      {a.actor} · {format(new Date(a.createdAt), 'd MMM, HH:mm', { locale: es })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
