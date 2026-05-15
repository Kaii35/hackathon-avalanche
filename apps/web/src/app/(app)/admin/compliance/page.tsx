'use client';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Switch,
} from '@hack/ui';
import { useOfferings } from '@/lib/client/queries/offerings';

const POLICIES = [
  {
    id: 'jurisdiction',
    label: 'JurisdictionModule',
    desc: 'Bloquea transferencias a jurisdicciones no permitidas.',
  },
  {
    id: 'maxHolders',
    label: 'MaxHoldersModule',
    desc: 'Aplica el cap CNBV de inversionistas calificados.',
  },
  {
    id: 'lockup',
    label: 'HoldingPeriodModule',
    desc: 'Impide transferencias antes del lockup configurado.',
  },
  { id: 'maxInv', label: 'MaxInvestmentModule', desc: 'Tope por inversionista no calificado.' },
];

export default function CompliancePage() {
  const { data } = useOfferings();
  return (
    <>
      <PageHeader
        title="Compliance"
        description="Configuración de módulos de compliance por oferta. Cualquier cambio queda en audit log y on-chain."
      />
      <div className="space-y-4">
        {(data ?? []).map((o) => (
          <Card key={o.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-sm">{o.name}</CardTitle>
                <CardDescription>
                  {o.symbol} · Sector {o.sector}
                </CardDescription>
              </div>
              <Badge variant={o.status === 'active' ? 'success' : 'neutral'}>{o.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {POLICIES.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-elevated p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 text-xs text-foreground-tertiary">{p.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
