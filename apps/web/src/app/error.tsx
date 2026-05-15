'use client';

import { Button } from '@hack/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // would log to monitoring in real app
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger-bg text-danger-fg">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-foreground-secondary">
          {error.message || 'Ocurrió un error inesperado.'} Puedes intentar de nuevo o regresar al
          inicio.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-2xs text-foreground-tertiary">id: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={reset}>
            Reintentar
          </Button>
          <Button asChild>
            <a href="/">Ir al inicio</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
