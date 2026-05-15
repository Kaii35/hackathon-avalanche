'use client';

import { useRouter } from 'next/navigation';
import {
  Activity,
  Briefcase,
  Building2,
  Globe,
  History,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  Shield,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { CommandPalette } from '@hack/ui';
import { useUiStore } from '@/lib/client/stores/uiStore';

export function AppCommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();
  const go = (href: string) => router.push(href);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      items={[
        {
          id: 'i1',
          label: 'Inversionista — Inicio',
          group: 'Navegar',
          icon: <LayoutDashboard />,
          onSelect: () => go('/investor'),
        },
        {
          id: 'i2',
          label: 'Mi portafolio',
          group: 'Navegar',
          icon: <Briefcase />,
          onSelect: () => go('/investor/portfolio'),
        },
        {
          id: 'i3',
          label: 'Marketplace de ofertas',
          group: 'Navegar',
          icon: <Store />,
          onSelect: () => go('/investor/offerings'),
        },
        {
          id: 'i4',
          label: 'Mis órdenes',
          group: 'Navegar',
          icon: <ListChecks />,
          onSelect: () => go('/investor/orders'),
        },
        {
          id: 'i5',
          label: 'Watchlist',
          group: 'Navegar',
          icon: <Star />,
          onSelect: () => go('/investor/watchlist'),
        },
        {
          id: 'i6',
          label: 'Actividad',
          group: 'Navegar',
          icon: <Activity />,
          onSelect: () => go('/investor/activity'),
        },
        {
          id: 'em1',
          label: 'Emisor — Inicio',
          group: 'Emisor',
          icon: <Building2 />,
          onSelect: () => go('/issuer'),
        },
        {
          id: 'em2',
          label: 'Crear nueva oferta',
          group: 'Emisor',
          icon: <PlusCircle />,
          onSelect: () => go('/issuer/offerings/new'),
        },
        {
          id: 'ad1',
          label: 'Admin — Inicio',
          group: 'Compliance',
          icon: <Shield />,
          onSelect: () => go('/admin'),
        },
        {
          id: 'ad2',
          label: 'Inversionistas',
          group: 'Compliance',
          icon: <Users />,
          onSelect: () => go('/admin/investors'),
        },
        {
          id: 'ad3',
          label: 'Jurisdicciones',
          group: 'Compliance',
          icon: <Globe />,
          onSelect: () => go('/admin/compliance/jurisdictions'),
        },
        {
          id: 'ad4',
          label: 'Audit log',
          group: 'Compliance',
          icon: <History />,
          onSelect: () => go('/admin/audit-log'),
        },
        {
          id: 'oc1',
          label: 'Crédito PYME Series A (AKAPYM)',
          group: 'Ofertas',
          icon: <Store />,
          onSelect: () => go('/investor/offerings/11111111-1111-1111-1111-111111111111'),
        },
        {
          id: 'oc2',
          label: 'Renta Industrial Bajío (BORENT)',
          group: 'Ofertas',
          icon: <Store />,
          onSelect: () => go('/investor/offerings/33333333-3333-3333-3333-333333333333'),
        },
        {
          id: 'oc3',
          label: 'Agro-Renovables MX (CVAGRO)',
          group: 'Ofertas',
          icon: <Store />,
          onSelect: () => go('/investor/offerings/22222222-2222-2222-2222-222222222222'),
        },
      ]}
    />
  );
}
