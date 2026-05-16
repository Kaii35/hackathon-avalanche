'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Store,
  ScrollText,
  Activity,
  Star,
  ListChecks,
  PlusCircle,
  Users,
  Shield,
  Globe,
  History,
  ChevronLeft,
  Building2,
} from 'lucide-react';
import { cn } from '@hack/ui';
import { Button } from '@hack/ui';
import { useUiStore } from '@/lib/client/stores/uiStore';
import { Logo, LogoMark } from '@/components/brand/Logo';

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const investorNav: NavSection[] = [
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
];

const issuerNav: NavSection[] = [
  {
    label: 'Emisor',
    items: [
      { label: 'Inicio', href: '/issuer', icon: LayoutDashboard },
      { label: 'Mis ofertas', href: '/issuer/offerings', icon: Building2 },
      { label: 'Crear oferta', href: '/issuer/offerings/new', icon: PlusCircle },
    ],
  },
];

const adminNav: NavSection[] = [
  {
    label: 'Compliance',
    items: [
      { label: 'Inicio', href: '/admin', icon: LayoutDashboard },
      { label: 'Inversionistas', href: '/admin/investors', icon: Users },
      { label: 'Compliance', href: '/admin/compliance', icon: Shield },
      { label: 'Jurisdicciones', href: '/admin/compliance/jurisdictions', icon: Globe },
      { label: 'Audit log', href: '/admin/audit-log', icon: History },
    ],
  },
];

function navForPath(path: string): NavSection[] {
  if (path.startsWith('/issuer')) return issuerNav;
  if (path.startsWith('/admin')) return adminNav;
  return investorNav;
}

function homeForPath(path: string): string {
  if (path.startsWith('/issuer')) return '/issuer';
  if (path.startsWith('/admin')) return '/admin';
  return '/investor';
}

/**
 * Picks the single active href via longest-prefix-wins so nested routes
 * don't also light up their parent (e.g. /investor/portfolio must not
 * activate /investor).
 */
function resolveActiveHref(path: string, sections: NavSection[]): string | null {
  let best: { href: string; len: number } | null = null;
  for (const section of sections) {
    for (const item of section.items) {
      const matches = path === item.href || path.startsWith(item.href + '/');
      if (matches && (!best || item.href.length > best.len)) {
        best = { href: item.href, len: item.href.length };
      }
    }
  }
  return best?.href ?? null;
}

export function Sidebar() {
  const path = usePathname() ?? '/';
  const sections = navForPath(path);
  const home = homeForPath(path);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  // Optimistic highlight: jumps the moment the user clicks, even before
  // the new route finishes compiling/loading. Cleared when the real path
  // catches up.
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  useEffect(() => {
    setOptimisticHref(null);
  }, [path]);

  const realActive = useMemo(() => resolveActiveHref(path, sections), [path, sections]);
  const activeHref = optimisticHref ?? realActive;

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-subtle bg-surface/40 backdrop-blur-sm md:flex',
        collapsed ? 'w-[72px]' : 'w-[244px]',
        'transition-[width] duration-200',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border-subtle px-3">
        <Link
          href={home}
          aria-label="Ir al inicio del portal"
          className="rounded-md px-1 py-1 transition-colors hover:bg-elevated"
        >
          {collapsed ? <LogoMark size={26} /> : <Logo size={24} />}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <ChevronLeft className={cn('transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-6">
            {!collapsed && (
              <p className="mb-1 px-2 text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = activeHref === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOptimisticHref(item.href)}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-elevated text-foreground'
                          : 'text-foreground-secondary hover:bg-elevated hover:text-foreground',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {active && !collapsed && (
                        <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-subtle p-3">
        {!collapsed ? (
          <div className="rounded-lg border border-border-subtle bg-elevated p-3 text-xs">
            <div className="flex items-center gap-2 text-success-fg">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-medium">Avalanche Fuji</span>
            </div>
            <p className="mt-1 text-foreground-tertiary">Subnet · Demo testnet</p>
          </div>
        ) : (
          <div className="grid place-items-center text-success-fg">
            <span className="h-2 w-2 rounded-full bg-success" />
          </div>
        )}
      </div>
    </aside>
  );
}
