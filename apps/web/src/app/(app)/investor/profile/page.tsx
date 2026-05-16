'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  PageHeader,
} from '@hack/ui';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { UpdateProfileSchema, type UpdateProfileDto, type SessionUser } from '@hack/shared';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY, useSession } from '@/lib/client/queries/session';

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useSession();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileDto>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { firstName: '', lastName: '' },
  });

  useEffect(() => {
    if (session) {
      reset({
        firstName: session.firstName ?? '',
        lastName: session.lastName ?? '',
      });
    }
  }, [session, reset]);

  const mutation = useMutation({
    mutationFn: (dto: UpdateProfileDto) =>
      api.call<{ user: SessionUser }>('/api/users/me', { method: 'PATCH', body: dto }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(SESSION_KEY, user);
      toast.success('Perfil actualizado');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        toast.error('Datos inválidos. Revisa el formulario.');
      } else {
        toast.error('No pudimos actualizar tu perfil. Intenta de nuevo.');
      }
    },
  });

  const onSubmit = (data: UpdateProfileDto) => mutation.mutate(data);

  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Actualiza tu nombre y apellido. Estos datos aparecen en tu dashboard y en tu KYC."
        actions={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Información personal</CardTitle>
            <CardDescription>
              Tu identidad legal — la que aparecerá en documentos regulatorios y reportes CNBV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" required>
                    Nombre
                  </Label>
                  <Input
                    id="firstName"
                    autoComplete="given-name"
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
                    invalid={Boolean(errors.lastName)}
                    {...register('lastName')}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-danger-fg">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" value={session?.email ?? ''} disabled readOnly />
                <p className="text-xs text-foreground-tertiary">
                  Para cambiar tu correo, contacta a soporte.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="submit"
                  loading={isSubmitting || mutation.isPending}
                  disabled={!isDirty || isLoading}
                >
                  Guardar cambios
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumen de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-foreground-tertiary">Rol</span>
              <span className="font-medium capitalize">{session?.role ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-tertiary">KYC</span>
              <span className="font-medium capitalize">{session?.kycStatus ?? 'pendiente'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-tertiary">Wallet primaria</span>
              <span className="font-mono text-2xs">
                {session?.primaryWallet
                  ? `${session.primaryWallet.slice(0, 6)}…${session.primaryWallet.slice(-4)}`
                  : 'No conectada'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
