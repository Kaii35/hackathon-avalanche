'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Building2, ChevronLeft, PieChart, ShieldCheck } from 'lucide-react';
import { RegisterSchema, type RegisterDto, type SessionUser } from '@hack/shared';
import { api, ApiError } from '@/lib/client/api';
import { SESSION_KEY } from '@/lib/client/queries/session';
import { DashboardLoadingScreen } from '@/components/loading/DashboardLoadingScreen';
import { AuthShell } from '@/components/auth/AuthShell';

/**
 * Form-only schema: same as RegisterSchema + a confirmPassword field. The
 * confirm field never reaches the backend (we drop it before POST), so it
 * lives here instead of polluting the shared DTO.
 */
const RegisterFormSchema = RegisterSchema.extend({
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});
type RegisterFormDto = z.infer<typeof RegisterFormSchema>;

type RoleChoice = RegisterDto['role']; // 'investor' | 'issuer' | 'admin'

// See login/page.tsx for rationale on the value.
const LOADING_HOLD_MS = 1200;

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
  const initialRole: RoleChoice | null =
    requestedRole === 'issuer' || requestedRole === 'investor' || requestedRole === 'admin'
      ? requestedRole
      : null;

  const [role, setRole] = useState<RoleChoice | null>(initialRole);
  const [accept, setAccept] = useState(false);
  const [transition, setTransition] = useState<{ greeting: string; href: string } | null>(null);

  // Pre-warm the post-register destination as soon as the role is picked,
  // so the route bundle + RSC payload are ready by the time the form submits.
  const onPickRole = (next: RoleChoice) => {
    setRole(next);
    router.prefetch(next === 'admin' ? '/admin-setup' : '/onboarding');
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormDto>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      role: initialRole ?? 'investor',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Keep the form's `role` field in sync with the panel chooser.
  useEffect(() => {
    if (role) setValue('role', role, { shouldValidate: false });
  }, [role, setValue]);

  const password = watch('password') ?? '';
  const score = useMemo(() => passwordScore(password), [password]);
  const strengthLabels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];

  const onSubmit = async (data: RegisterFormDto) => {
    if (!accept) {
      toast.error('Debes aceptar los términos.');
      return;
    }
    try {
      const { confirmPassword: _cp, ...payload } = data;
      const res = await api.call<{ user: SessionUser }>('/api/auth/register', {
        method: 'POST',
        body: payload satisfies RegisterDto,
      });
      queryClient.setQueryData(SESSION_KEY, res.user);
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      // Mark "freshly registered" so the dashboard's wallet welcome modal
      // pops only for new users (existing logins skip it). One-shot — the
      // dialog effect consumes and clears this flag. Admins don't need the
      // dashboard modal because they go through a dedicated /admin-setup
      // screen, so skip the flag for them.
      if (typeof window !== 'undefined' && res.user.role !== 'admin') {
        window.sessionStorage.setItem('wallet-welcome-pending', '1');
      }
      const firstName = res.user.firstName ?? data.firstName;
      // Admins land on a standalone wallet-link screen (no stepper, no
      // KYC pretense). Investors/issuers go through the full onboarding.
      const target = res.user.role === 'admin' ? '/admin-setup' : '/onboarding';
      router.prefetch(target);
      setTransition({
        greeting: firstName ? `Bienvenido, ${firstName}` : 'Cuenta creada',
        href: target,
      });
      toast.success(`Cuenta creada. Bienvenido, ${res.user.displayName}`);
      window.setTimeout(() => router.push(target), LOADING_HOLD_MS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error('Ya existe una cuenta con ese email.');
        } else if (err.status === 401 && data.role === 'admin') {
          toast.error('No autorizado. Pide a un admin existente que pre-registre tu correo.');
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

  if (transition) {
    return (
      <DashboardLoadingScreen greeting={transition.greeting} subtitle="Configurando tu cuenta…" />
    );
  }

  return (
    <AuthShell>
      <AnimatePresence mode="wait">
        {role === null ? (
          <motion.div
            key="role-chooser"
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-8 text-center"
          >
            <div className="space-y-2">
              <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                Crea tu cuenta
              </h1>
              <p className="text-lg font-light text-white/70">¿Qué tipo de cuenta?</p>
            </div>

            <div className="space-y-3">
              <RoleButton
                icon={<PieChart className="size-5" />}
                title="Inversionista"
                subtitle="Compro y vendo participaciones de IFCs"
                onClick={() => onPickRole('investor')}
              />
              <RoleButton
                icon={<Building2 className="size-5" />}
                title="Emisor (IFC)"
                subtitle="Emito ofertas y administro cap table"
                onClick={() => onPickRole('issuer')}
              />
              <RoleButton
                icon={<ShieldCheck className="size-5" />}
                title="Administrador"
                subtitle="Solo correos pre-aprobados por compliance"
                onClick={() => onPickRole('admin')}
              />
            </div>

            <p className="pt-2 text-sm text-white/60">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-white underline-offset-4 hover:underline">
                Inicia sesión
              </Link>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form-step"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-5"
          >
            <button
              type="button"
              onClick={() => {
                setRole(null);
                reset();
                setAccept(false);
              }}
              className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
            >
              <ChevronLeft className="size-4" />
              Volver
            </button>

            <div className="space-y-1 text-center">
              <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-white">
                {role === 'issuer'
                  ? 'Cuenta de Emisor'
                  : role === 'admin'
                    ? 'Cuenta de Administrador'
                    : 'Cuenta de Inversionista'}
              </h1>
              <p className="text-sm font-light text-white/60">
                {role === 'issuer'
                  ? 'Solo IFCs reguladas por CNBV.'
                  : role === 'admin'
                    ? 'Requiere invitación previa de un admin existente.'
                    : 'Empieza tu KYC y conecta tu wallet en minutos.'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <input type="hidden" {...register('role')} value={role} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Nombre"
                    className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                    aria-invalid={Boolean(errors.firstName)}
                    {...register('firstName')}
                  />
                  {errors.firstName && (
                    <p className="mt-1 px-2 text-xs text-red-300">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Apellido"
                    className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                    aria-invalid={Boolean(errors.lastName)}
                    {...register('lastName')}
                  />
                  {errors.lastName && (
                    <p className="mt-1 px-2 text-xs text-red-300">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="tu@empresa.mx"
                  className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 px-2 text-xs text-red-300">{errors.email.message}</p>
                )}
              </div>

              <div>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Contraseña"
                  className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <div className="mt-1.5 grid grid-cols-4 gap-1 px-2">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 rounded-full transition-colors ${
                        i < score
                          ? score <= 1
                            ? 'bg-red-400'
                            : score === 2
                              ? 'bg-amber-400'
                              : score === 3
                                ? 'bg-blue-400'
                                : 'bg-emerald-400'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 px-2 text-xs text-white/50">
                  Fortaleza: {strengthLabels[score]}
                </p>
                {errors.password && (
                  <p className="mt-1 px-2 text-xs text-red-300">{errors.password.message}</p>
                )}
              </div>

              <div>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite tu contraseña"
                  className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center text-white placeholder:text-white/30 backdrop-blur-sm transition-colors focus:border-white/30 focus:outline-none"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 px-2 text-xs text-red-300">{errors.confirmPassword.message}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 px-2 pt-2 text-xs text-white/60">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 accent-white"
                />
                <span>
                  Acepto los{' '}
                  <Link href="#" className="text-white underline-offset-4 hover:underline">
                    Términos
                  </Link>{' '}
                  y la{' '}
                  <Link href="#" className="text-white underline-offset-4 hover:underline">
                    Política
                  </Link>{' '}
                  en cumplimiento con CNBV y Ley Fintech.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !accept}
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creando…' : 'Crear cuenta'}
                {!isSubmitting && (
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            <p className="text-center text-xs text-white/50">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-white/80 underline-offset-4 hover:underline">
                Inicia sesión
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}

function RoleButton({
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
