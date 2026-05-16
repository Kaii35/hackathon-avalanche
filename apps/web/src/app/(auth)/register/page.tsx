'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { RegisterSchema, type RegisterDto, type SessionUser } from '@hack/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from '@hack/ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY } from '@/lib/client/queries/session';
import { DashboardLoadingScreen } from '@/components/loading/DashboardLoadingScreen';

const LOADING_HOLD_MS = 4000;

function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role');
  const initialRole: RegisterDto['role'] =
    requestedRole === 'issuer' || requestedRole === 'investor' ? requestedRole : 'investor';
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { role: initialRole, firstName: '', lastName: '', email: '', password: '' },
  });
  const [accept, setAccept] = useState(false);
  const [transition, setTransition] = useState<{ greeting: string; href: string } | null>(null);

  const password = watch('password') ?? '';
  const score = useMemo(() => passwordScore(password), [password]);

  const onSubmit = async (data: RegisterDto) => {
    if (!accept) {
      toast.error('Debes aceptar los términos.');
      return;
    }
    try {
      const res = await api.call<{ user: SessionUser }>('/api/auth/register', {
        method: 'POST',
        body: data,
      });
      queryClient.setQueryData(SESSION_KEY, res.user);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      const firstName = res.user.firstName ?? data.firstName;
      router.prefetch('/onboarding');
      setTransition({
        greeting: firstName ? `Bienvenido, ${firstName}` : 'Cuenta creada',
        href: '/onboarding',
      });
      toast.success(`Cuenta creada. Bienvenido, ${res.user.displayName}`);
      window.setTimeout(() => router.push('/onboarding'), LOADING_HOLD_MS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error('Ya existe una cuenta con ese email.');
        } else if (err.status === 400) {
          toast.error('Datos inválidos. Revisa el formulario.');
        } else {
          toast.error('No pudimos crear tu cuenta. Intenta de nuevo.');
        }
      } else {
        toast.error('Error de red. Verifica tu conexión.');
      }
    }
  };

  const strengthLabels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];

  if (transition) {
    return (
      <DashboardLoadingScreen greeting={transition.greeting} subtitle="Configurando tu cuenta…" />
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crea tu cuenta</CardTitle>
        <CardDescription>Empieza tu KYC y conecta tu wallet en minutos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" required>
                Nombre
              </Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="María"
                invalid={Boolean(errors.firstName)}
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-xs text-danger-fg">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" required>
                Apellido
              </Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="López"
                invalid={Boolean(errors.lastName)}
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-xs text-danger-fg">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@empresa.mx"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-danger-fg">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" required>
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full ${
                    i < score
                      ? score <= 1
                        ? 'bg-danger'
                        : score === 2
                          ? 'bg-warning'
                          : score === 3
                            ? 'bg-info'
                            : 'bg-success'
                      : 'bg-overlay'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-foreground-tertiary">
              Fortaleza: {strengthLabels[score]} · Mínimo 8 caracteres, idealmente con mayúsculas,
              números y símbolos.
            </p>
            {errors.password && <p className="text-xs text-danger-fg">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Tipo de cuenta</Label>
            <select
              id="role"
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              {...register('role')}
            >
              <option value="investor">Inversionista</option>
              <option value="issuer">Emisor (IFC)</option>
            </select>
          </div>

          <label className="flex items-start gap-2.5 pt-1 text-sm text-foreground-secondary">
            <Checkbox
              checked={accept}
              onCheckedChange={(v) => setAccept(Boolean(v))}
              className="mt-0.5"
            />
            <span>
              Acepto los{' '}
              <Link href="#" className="text-brand-400 hover:text-brand-300">
                Términos
              </Link>{' '}
              y la{' '}
              <Link href="#" className="text-brand-400 hover:text-brand-300">
                Política de privacidad
              </Link>{' '}
              en cumplimiento con CNBV y Ley Fintech.
            </span>
          </label>

          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!accept}>
            Crear cuenta
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground-secondary">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-brand-400 hover:text-brand-300">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
