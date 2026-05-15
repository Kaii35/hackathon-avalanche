import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-mesh opacity-80" />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[420px] [background-image:radial-gradient(circle_at_50%_-10%,rgba(232,65,66,0.18)_0,transparent_55%)]"
      />
      <div className="container flex min-h-screen flex-col">
        <header className="flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-brand text-xs font-bold text-white shadow-glow-brand">
              ▲
            </span>
            <span className="font-semibold tracking-tight">Mercado IFC</span>
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
