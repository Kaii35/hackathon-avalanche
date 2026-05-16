'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Menu, Search, Settings, User2, LogOut, ChevronDown } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  WalletAddress,
} from '@hack/ui';
import { useUiStore } from '@/lib/client/stores/uiStore';
import { useWallet } from '@/hooks/useWallet';
import { useSession, useLogout } from '@/lib/client/queries/session';
import { MobileNav } from './MobileNav';

export function Topbar() {
  const setCommand = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();
  const { address, realConnected } = useWallet();
  const { data: session, isLoading } = useSession();
  const logout = useLogout();

  const displayName = session?.displayName ?? (isLoading ? 'Cargando…' : 'Invitado');
  const initials = session?.initials ?? '··';
  const email = session?.email ?? '';

  const onLogout = async () => {
    await logout.mutateAsync();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border-subtle bg-canvas/80 px-4 backdrop-blur-md md:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Abrir navegación"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <MobileNav />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => setCommand(true)}
        className="group flex h-9 flex-1 max-w-md items-center gap-2 rounded-md border border-border-subtle bg-surface/60 px-3 text-sm text-foreground-tertiary transition-colors hover:border-border hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar oferta, orden, dirección…</span>
        <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
          <kbd className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-2xs">
            ⌘
          </kbd>
          <kbd className="rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-2xs">
            K
          </kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="outline" className="hidden md:inline-flex">
          <span
            className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
              realConnected ? 'bg-success animate-pulse' : 'bg-foreground-tertiary'
            }`}
          />
          Avalanche · Fuji
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Notificaciones">
              <span className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto py-1">
              <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">Bienvenido a la plataforma</span>
                <span className="text-xs text-foreground-tertiary">
                  Completa tu KYC para empezar a operar.
                </span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/investor/activity')}>
              Ver toda la actividad
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {realConnected && address && (
          <div className="hidden items-center rounded-md border border-border-subtle bg-surface px-2 py-1 sm:flex">
            <WalletAddress address={address} size="sm" />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-md border border-transparent p-0.5 transition-colors hover:border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label="Menú de usuario"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden h-3.5 w-3.5 text-foreground-tertiary md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-2">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              {email && (
                <p className="truncate text-xs text-foreground-tertiary" title={email}>
                  {email}
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/investor/profile">
                <User2 className="h-4 w-4" /> Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} disabled={logout.isPending}>
              <LogOut className="h-4 w-4" />
              {logout.isPending ? 'Cerrando…' : 'Cerrar sesión'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
