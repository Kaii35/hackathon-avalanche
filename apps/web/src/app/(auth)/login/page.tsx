'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ShieldCheck, Users } from 'lucide-react';
import { LoginSchema, type LoginDto, type SessionUser } from '@hack/shared';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY } from '@/lib/client/queries/session';
import { DashboardLoadingScreen } from '@/components/loading/DashboardLoadingScreen';
import { AuthShell } from '@/components/auth/AuthShell';

// Minimum splash duration so the "Bienvenido" greeting doesn't flash and
// disappear instantly when the auth round-trip is fast (<300ms). Keep this
// short — anything over ~1.5s feels broken. Use 1200ms (matches Material's
// "long" motion token).
const LOADING_HOLD_MS = 1200;

function landingFor(role: SessionUser['role']): string {
  if (role === 'admin') return '/admin';
  if (role === 'issuer') return '/issuer';
  return '/investor';
}

type Panel = 'user' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [transition, setTransition] = useState<{ greeting: string; href: string } | null>(null);

  // Warm the landing routes the moment the user picks a panel so the JS
  // bundle is already in cache by the time auth succeeds. Issuer doesn't
  // have its own panel button (uses 'user'), so prefetch both portals.
  const onPickPanel = (next: Panel) => {
    setPanel(next);
    if (next === 'admin') {
      router.prefetch('/admin');
    } else {
      router.prefetch('/investor');
      router.prefetch('/issuer');
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginDto) => {
    try {
      const res = await api.call<{ user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: { ...data, panel },
      });
      queryClient.setQueryData(SESSION_KEY, res.user);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      const firstName = res.user.firstName ?? res.user.displayName.split(' ')[0] ?? null;
      const href = landingFor(res.user.role);
      router.prefetch(href);
      setTransition({
        greeting: firstName ? `Bienvenido, ${firstName}` : 'Bienvenido',
        href,
      });
      toast.success(`Bienvenido, ${res.user.displayName}`);
      window.setTimeout(() => router.push(href), LOADING_HOLD_MS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error(
            panel === 'admin'
              ? 'Credenciales inválidas para el panel de administración.'
              : 'Credenciales inválidas. Verifica tu email y contraseña.',
          );
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

  if (transition) {
    return (
      <DashboardLoadingScreen greeting={transition.greeting} subtitle="Preparando tu dashboard…" />
    );
  }

  return (
    <AuthShell>
      <AnimatePresence mode="wait">
        {panel === null ? (
          <motion.div
            key="chooser"
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-8 text-center"
          >
            <div className="space-y-2">
              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                Iniciar sesión
              </h1>
              <p className="text-lg font-light text-white/70">¿Cómo quieres entrar?</p>
            </div>

            <div className="space-y-3">
              <PanelButton
                icon={<Users className="size-5" />}
                title="Como usuario"
                subtitle="Inversionista o emisor IFC"
                onClick={() => onPickPanel('user')}
              />
              <PanelButton
                icon={<ShieldCheck className="size-5" />}
                title="Como administrador"
                subtitle="Compliance · operaciones"
                onClick={() => onPickPanel('admin')}
              />
            </div>

            <p className="pt-2 text-sm text-white/60">
              ¿Aún no tienes cuenta?{' '}
              <Link href="/register" className="text-white underline-offset-4 hover:underline">
                Crea una
              </Link>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6"
          >
            <button
              type="button"
              onClick={() => {
                setPanel(null);
                reset();
              }}
              className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
            >
              <ChevronLeft className="size-4" />
              Volver
            </button>

            <div className="space-y-1 text-center">
              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                {panel === 'admin' ? 'Panel admin' : 'Bienvenido'}
              </h1>
              <p className="text-base font-light text-white/70">
                {panel === 'admin'
                  ? 'Solo cuentas de compliance autorizadas.'
                  : 'Entra a tu portafolio.'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && <p className="px-2 text-xs text-red-300">{errors.email.message}</p>}

              <input
                type="password"
                autoComplete="current-password"
                placeholder="contraseña"
                className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password && (
                <p className="px-2 text-xs text-red-300">{errors.password.message}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
                {!isSubmitting && (
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-white/50">
              <Link href="/forgot-password" className="hover:text-white">
                ¿Olvidaste tu contraseña?
              </Link>
              {panel === 'user' && (
                <Link href="/register" className="hover:text-white">
                  Crear cuenta
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}

function PanelButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors group-hover:bg-white/20">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-xs text-white/50">{subtitle}</p>
      </div>
      <ArrowRight className="size-4 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
    </button>
  );
}
