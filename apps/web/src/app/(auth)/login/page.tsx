'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoginSchema, type LoginDto, type SessionUser } from '@hack/shared';
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
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY } from '@/lib/client/queries/session';

function landingFor(role: SessionUser['role']): string {
  if (role === 'admin') return '/admin';
  if (role === 'issuer') return '/issuer';
  return '/investor';
}

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginDto) => {
    try {
      const res = await api.call<{ user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: data,
      });
      queryClient.setQueryData(SESSION_KEY, res.user);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      toast.success(`Bienvenido, ${res.user.displayName}`);
      router.push(landingFor(res.user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error('Credenciales inválidas. Verifica tu email y contraseña.');
        } else if (err.status === 429) {
          toast.error('Demasiados intentos. Espera un minuto e intenta de nuevo.');
        } else if (err.status === 400) {
          toast.error('Datos inválidos. Revisa el formato del email.');
        } else {
          toast.error('No pudimos iniciar sesión. Intenta de nuevo.');
        }
      } else {
        toast.error('Error de red. Verifica tu conexión.');
      }
    }
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
              placeholder="tu@arkangeles.mx"
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

        <div className="flex justify-center [&_button]:w-full">
          <ConnectButton.Custom>
            {({ openConnectModal, account, openAccountModal, mounted }) => (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={account ? openAccountModal : openConnectModal}
                disabled={!mounted}
              >
                {account ? `Conectado: ${account.displayName}` : 'Conectar wallet'}
              </Button>
            )}
          </ConnectButton.Custom>
        </div>

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
