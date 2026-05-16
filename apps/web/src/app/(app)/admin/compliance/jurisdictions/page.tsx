'use client';

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  PageHeader,
  Switch,
} from '@hack/ui';
import type { ColumnDef } from '@tanstack/react-table';

interface Jurisdiction {
  iso: number;
  name: string;
  flag: string;
  allowed: boolean;
  investors: number;
  policy: string;
}

const JURISDICTIONS: Jurisdiction[] = [
  {
    iso: 484,
    name: 'México',
    flag: '🇲🇽',
    allowed: true,
    investors: 1140,
    policy: 'Default · CNBV / Ley Fintech',
  },
  {
    iso: 840,
    name: 'Estados Unidos',
    flag: '🇺🇸',
    allowed: true,
    investors: 92,
    policy: 'Reg D 506(c) · accredited only',
  },
  {
    iso: 724,
    name: 'España',
    flag: '🇪🇸',
    allowed: true,
    investors: 48,
    policy: 'CNMV · profesional',
  },
  {
    iso: 124,
    name: 'Canadá',
    flag: '🇨🇦',
    allowed: false,
    investors: 0,
    policy: 'Pendiente OSC review',
  },
  { iso: 32, name: 'Argentina', flag: '🇦🇷', allowed: false, investors: 0, policy: 'CNV review' },
  { iso: 76, name: 'Brasil', flag: '🇧🇷', allowed: false, investors: 0, policy: 'CVM review' },
  { iso: 152, name: 'Chile', flag: '🇨🇱', allowed: true, investors: 4, policy: 'CMF · profesional' },
];

const columns: ColumnDef<Jurisdiction>[] = [
  {
    header: 'Jurisdicción',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <span className="text-lg">{row.original.flag}</span>
        <span className="font-medium">{row.original.name}</span>
        <span className="font-mono text-2xs text-foreground-tertiary">ISO {row.original.iso}</span>
      </div>
    ),
  },
  {
    header: 'Estado',
    accessorKey: 'allowed',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Switch defaultChecked={row.original.allowed} />
        <Badge variant={row.original.allowed ? 'success' : 'neutral'} size="sm">
          {row.original.allowed ? 'Permitida' : 'Bloqueada'}
        </Badge>
      </div>
    ),
  },
  {
    header: 'Inversionistas',
    accessorKey: 'investors',
    cell: ({ row }) => (
      <span className="tabular">{row.original.investors.toLocaleString('es-MX')}</span>
    ),
  },
  {
    header: 'Política',
    accessorKey: 'policy',
    cell: ({ row }) => (
      <span className="text-xs text-foreground-secondary">{row.original.policy}</span>
    ),
  },
];

export default function JurisdictionsPage() {
  const allowed = JURISDICTIONS.filter((j) => j.allowed);
  return (
    <>
      <PageHeader
        title="Jurisdicciones"
        description="Países permitidos a nivel global. Las ofertas pueden restringir adicionalmente."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Cobertura mundial</CardTitle>
          </CardHeader>
          <CardContent>
            <WorldMap activeIso={allowed.map((j) => j.iso)} />
            <p className="mt-3 text-2xs text-foreground-tertiary">
              {allowed.length} de {JURISDICTIONS.length} jurisdicciones habilitadas
            </p>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <DataTable columns={columns} data={JURISDICTIONS} pageSize={10} />
        </div>
      </div>
    </>
  );
}

function WorldMap({ activeIso }: { activeIso: number[] }) {
  const dots = [
    { iso: 484, x: 22, y: 42, label: 'MX' },
    { iso: 840, x: 28, y: 32, label: 'US' },
    { iso: 124, x: 30, y: 22, label: 'CA' },
    { iso: 724, x: 50, y: 30, label: 'ES' },
    { iso: 32, x: 32, y: 76, label: 'AR' },
    { iso: 152, x: 30, y: 70, label: 'CL' },
    { iso: 76, x: 38, y: 64, label: 'BR' },
  ];
  return (
    <svg viewBox="0 0 100 80" className="aspect-[5/4] w-full" aria-label="Mapa mundial">
      <rect width="100" height="80" fill="hsl(222 18% 10%)" />
      <rect width="100" height="80" fill="url(#grid)" opacity="0.5" />
      <defs>
        <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="hsl(222 14% 18%)" strokeWidth="0.2" />
        </pattern>
      </defs>
      {dots.map((d) => (
        <g key={d.iso}>
          <circle
            cx={d.x}
            cy={d.y}
            r="2"
            fill={activeIso.includes(d.iso) ? '#2A5BFF' : '#52525b'}
            stroke="white"
            strokeOpacity="0.1"
          />
          {activeIso.includes(d.iso) && (
            <circle cx={d.x} cy={d.y} r="3.5" fill="none" stroke="#2A5BFF" strokeOpacity="0.4">
              <animate attributeName="r" from="2" to="6" dur="2s" repeatCount="indefinite" />
              <animate
                attributeName="stroke-opacity"
                from="0.5"
                to="0"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <text x={d.x + 3} y={d.y + 1.4} fontSize="2.4" fill="#a1a1aa">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
