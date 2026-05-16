'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import {
  Activity,
  Briefcase,
  Building2,
  Globe,
  History,
  LayoutDashboard,
  ListChecks,
  PieChart,
  PlusCircle,
  ScrollText,
  Shield,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { cn } from '@hack/ui';

const sections = [
  {
    label: 'Inversionista',
    items: [
      { label: 'Inicio', href: '/investor', icon: LayoutDashboard },
      { label: 'Portafolio', href: '/investor/portfolio', icon: Briefcase },
      { label: 'Marketplace', href: '/investor/offerings', icon: Store },
      { label: 'Mis órdenes', href: '/investor/orders', icon: ListChecks },
      { label: 'Trades', href: '/investor/trades', icon: ScrollText },
      { label: 'Watchlist', href: '/investor/watchlist', icon: Star },
      { label: 'Actividad', href: '/investor/activity', icon: Activity },
    ],
  },
  {
    label: 'Emisor',
    items: [
      { label: 'Inicio', href: '/issuer', icon: PieChart },
      { label: 'Mis ofertas', href: '/issuer/offerings', icon: Building2 },
      { label: 'Crear oferta', href: '/issuer/offerings/new', icon: PlusCircle },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'Inicio', href: '/admin', icon: Shield },
      { label: 'Inversionistas', href: '/admin/investors', icon: Users },
      { label: 'Jurisdicciones', href: '/admin/compliance/jurisdictions', icon: Globe },
      { label: 'Audit log', href: '/admin/audit-log', icon: History },
    ],
  },
];

function homeForPath(path: string): string {
  if (path.startsWith('/issuer')) return '/issuer';
  if (path.startsWith('/admin')) return '/admin';
  return '/investor';
}

export function MobileNav() {
  const path = usePathname() ?? '/';
  const home = homeForPath(path);
  return (
    <nav className="flex h-full flex-col p-4">
      <Link href={home} className="mb-6 inline-block" aria-label="Ir al inicio del portal">
        <Logo size={24} />
      </Link>
      <div className="flex-1 overflow-y-auto pr-2">
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="mb-2 px-2 text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  path === item.href || (item.href !== '/' && path.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-elevated text-foreground'
                          : 'text-foreground-secondary hover:bg-elevated hover:text-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
