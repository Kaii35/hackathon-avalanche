'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@hack/ui';
import { CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
        <CardDescription>
          Te enviaremos un enlace de recuperación a tu correo registrado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-success-border bg-success-bg p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-success-fg" />
            <p className="text-sm text-foreground">
              Si la cuenta existe, te enviamos un enlace de recuperación.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Correo electrónico
              </Label>
              <Input id="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full">
              Enviar enlace
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-foreground-secondary">
          <Link href="/login" className="font-medium text-brand-400 hover:text-brand-300">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
