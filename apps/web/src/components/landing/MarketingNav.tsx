'use client';

import Link from 'next/link';
import { Button } from '@hack/ui';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/70 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-xs font-bold text-white shadow-glow-brand">
            ▲
          </span>
          <span className="font-semibold tracking-tight text-foreground">Mercado IFC</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-foreground-secondary md:flex">
          <a href="#producto" className="hover:text-foreground transition-colors">
            Producto
          </a>
          <a href="#arquitectura" className="hover:text-foreground transition-colors">
            Arquitectura
          </a>
          <a href="#compliance" className="hover:text-foreground transition-colors">
            Compliance
          </a>
          <a href="#faq" className="hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
