'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Lock } from 'lucide-react';
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

// cobe is WebGL → client only.
const GlobeCdn = dynamic(() => import('@/components/ui/cobe-globe-cdn').then((m) => m.GlobeCdn), {
  ssr: false,
});

const COUNTRY_COORDS: Record<number, { code: string; lat: number; lng: number }> = {
  124: { code: 'CA', lat: 56.1, lng: -106.3 },
  840: { code: 'US', lat: 39.8, lng: -98.6 },
  484: { code: 'MX', lat: 23.6, lng: -102.5 },
  76: { code: 'BR', lat: -14.2, lng: -51.9 },
  152: { code: 'CL', lat: -35.7, lng: -71.5 },
  32: { code: 'AR', lat: -38.4, lng: -63.6 },
  724: { code: 'ES', lat: 40.5, lng: -3.7 },
};

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
    cell: ({ row }) => {
      const blocked = !row.original.allowed;
      return (
        <div className="flex items-center gap-3">
          <Switch
            defaultChecked={row.original.allowed}
            disabled={blocked}
            aria-label={
              blocked
                ? `${row.original.name} bloqueada por ${row.original.policy}`
                : `Alternar ${row.original.name}`
            }
          />
          <Badge
            variant={row.original.allowed ? 'success' : 'neutral'}
            size="sm"
            title={blocked ? row.original.policy : undefined}
          >
            {blocked && <Lock className="size-3" aria-hidden="true" />}
            {row.original.allowed ? 'Permitida' : 'Bloqueada'}
          </Badge>
        </div>
      );
    },
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

  // Map our jurisdictions to GlobeCdn marker shape. Only render allowed ones
  // on the globe — blocked ones live in the chip list below the globe.
  // GlobeCdn is hardcoded to a light/white sphere, so we wrap it on a white
  // tile so it reads correctly even when the surrounding app is dark.
  const globeMarkers = useMemo(
    () =>
      allowed
        .map((j) => {
          const coords = COUNTRY_COORDS[j.iso];
          if (!coords) return null;
          return {
            id: `cdn-${coords.code.toLowerCase()}`,
            location: [coords.lat, coords.lng] as [number, number],
            region: coords.code,
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [allowed],
  );

  return (
    <>
      <PageHeader
        title="Jurisdicciones"
        description="Países permitidos a nivel global. Las ofertas pueden restringir adicionalmente."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Cobertura mundial</CardTitle>
          </CardHeader>
          <CardContent>
            {/* GlobeCdn is theme-aware:
                · light → original CDN look (warm beige glow, soft sphere)
                · dark  → cool brand-blue glow bridging white sphere to dark canvas
                The brand wash behind only appears in dark mode (light surface
                doesn't need the bridging). */}
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 blur-3xl dark:opacity-100"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, rgba(42,91,255,0.25), transparent 65%)',
                }}
              />
              <GlobeCdn markers={globeMarkers} arcs={[]} className="relative" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-2xs">
              <p className="text-foreground-tertiary">
                <span className="font-mono font-semibold text-foreground">
                  {allowed.length}/{JURISDICTIONS.length}
                </span>{' '}
                jurisdicciones habilitadas
              </p>
              <div className="flex items-center gap-2.5 text-foreground-tertiary">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-foreground" />
                  Activa
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1 rounded-full bg-foreground-tertiary" />
                  Bloqueada
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {JURISDICTIONS.map((j) => {
                const coords = COUNTRY_COORDS[j.iso];
                if (!coords) return null;
                return (
                  <span
                    key={j.iso}
                    title={j.allowed ? j.name : `${j.name} · bloqueada`}
                    className={
                      j.allowed
                        ? 'inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-1.5 py-0.5 font-mono text-2xs text-brand-400'
                        : 'inline-flex items-center gap-1 rounded-md border border-border-subtle bg-elevated px-1.5 py-0.5 font-mono text-2xs text-foreground-tertiary'
                    }
                  >
                    {!j.allowed && <Lock className="size-2.5" aria-hidden="true" />}
                    {coords.code}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <DataTable columns={columns} data={JURISDICTIONS} pageSize={10} />
        </div>
      </div>
    </>
  );
}
