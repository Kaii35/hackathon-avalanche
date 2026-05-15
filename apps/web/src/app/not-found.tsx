import Link from 'next/link';
import { Button } from '@hack/ui';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="text-2xs font-medium uppercase tracking-wider text-brand-400">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Página no encontrada</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-foreground-secondary">
          La ruta que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/">Inicio</Link>
          </Button>
          <Button asChild>
            <Link href="/investor">Mi cuenta</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
