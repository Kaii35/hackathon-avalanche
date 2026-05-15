'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginDto } from '@hack/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from '@hack/ui';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: 'demo@arkangeles.test', password: 'demoaccount' },
  });

  const onSubmit = async (data: LoginDto) => {
    await new Promise((r) => setTimeout(r, 600));
    toast.success(`Bienvenido, ${data.email.split('@')[0]}.`);
    router.push('/investor');
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Bienvenido de vuelta</CardTitle>
        <CardDescription>Inicia sesión para acceder a tu portafolio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger-fg">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>
                Contraseña
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs text-foreground-tertiary hover:text-foreground"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
            {errors.password && <p className="text-xs text-danger-fg">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Iniciar sesión
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-2xs uppercase tracking-wider text-foreground-tertiary">
          <Separator className="flex-1" />o<Separator className="flex-1" />
        </div>

        <Button variant="secondary" className="w-full">
          <Wallet className="h-4 w-4" />
          Conectar wallet
        </Button>

        <p className="mt-6 text-center text-sm text-foreground-secondary">
          ¿Aún no tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-brand-400 hover:text-brand-300">
            Crea una
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
