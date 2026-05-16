'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@hack/ui';
import { useTheme } from 'next-themes';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';

// WebSDK has to render client-side only — no SSR shell.
const SumsubWebSdk = dynamic(() => import('@sumsub/websdk-react'), { ssr: false });

type Phase = 'idle' | 'loading' | 'ready' | 'pending' | 'verified' | 'rejected' | 'error';

interface TokenResponse {
  token: string;
  applicantId: string;
  externalUserId: string;
  levelName: string;
}

interface StatusResponse {
  status: 'unconfigured' | 'not_started' | 'pending' | 'verified' | 'rejected';
  reviewStatus?: string;
  applicantId?: string;
  identityRegistered?: { txHash?: string | null; alreadyVerified?: boolean };
}

export default function KycPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { patch } = useOnboardingStore();

  const [phase, setPhase] = useState<Phase>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Start a session: ask backend for a one-shot WebSDK token.
  const startKyc = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/kyc/sumsub/token', { method: 'POST' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TokenResponse;
      setToken(data.token);
      setApplicantId(data.applicantId);
      setPhase('ready');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, []);

  // Refresh handler the WebSDK calls when its token expires (~10 min).
  const onTokenExpired = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/kyc/sumsub/token', { method: 'POST' });
    const data = (await res.json()) as TokenResponse;
    setToken(data.token);
    return data.token;
  }, []);

  // Once the user submits, poll for final status so we get the on-chain tx
  // hash even if the webhook can't reach localhost.
  useEffect(() => {
    if (phase !== 'pending') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/kyc/sumsub/status');
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (cancelled) return;
        if (data.status === 'verified') {
          setPhase('verified');
          if (data.identityRegistered?.txHash) setTxHash(data.identityRegistered.txHash);
        } else if (data.status === 'rejected') {
          setPhase('rejected');
        }
      } catch {
        /* swallow — keep polling */
      }
    };

    void tick();
    const id = setInterval(tick, 4_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase]);

  // Sumsub WebSDK event hook
  const onMessage = useCallback((type: string, payload: unknown) => {
    if (type === 'idCheck.onApplicantSubmitted') {
      setPhase('pending');
    } else if (type === 'idCheck.onApplicantStatusChanged') {
      const review = (payload as { reviewResult?: { reviewAnswer?: string } } | undefined)
        ?.reviewResult?.reviewAnswer;
      if (review === 'GREEN') setPhase('verified');
      else if (review === 'RED') setPhase('rejected');
    }
  }, []);

  const onSdkError = useCallback((err: unknown) => {
    setErrorMessage(err instanceof Error ? err.message : JSON.stringify(err));
    setPhase('error');
  }, []);

  // When verified, persist that into the wizard store so the "Continue" button
  // unlocks consistently with the previous mock flow.
  useEffect(() => {
    if (phase === 'verified') {
      patch({ documentUploaded: true, proofUploaded: true });
    }
  }, [phase, patch]);

  const ready = phase === 'verified';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación de identidad</CardTitle>
        <CardDescription>
          Sube tu documento mediante Sumsub. En sandbox puedes usar cualquier identificación de
          prueba. Al aprobarse, registramos tu wallet en{' '}
          <span className="font-mono text-xs">IdentityRegistry</span> en Fuji.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === 'idle' && (
          <div className="rounded-lg border border-dashed border-border bg-elevated/40 p-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-brand-400" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Listos para iniciar tu verificación
            </p>
            <p className="mt-1 text-xs text-foreground-tertiary">
              El proceso toma ~2 min. Necesitas tu identificación oficial vigente.
            </p>
            <Button className="mt-4" onClick={startKyc}>
              Iniciar verificación
            </Button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-elevated/40 p-8 text-sm text-foreground-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando sesión segura con Sumsub…
          </div>
        )}

        {(phase === 'ready' || phase === 'pending') && token && (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
            <SumsubWebSdk
              accessToken={token}
              expirationHandler={onTokenExpired}
              config={{
                lang: 'es',
                theme: resolvedTheme === 'light' ? 'light' : 'dark',
              }}
              options={{ adaptIframeHeight: true }}
              onMessage={onMessage}
              onError={onSdkError}
            />
          </div>
        )}

        {phase === 'pending' && (
          <div className="flex items-center gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-sm text-foreground-secondary">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-info-fg" />
            <span>
              Sumsub está revisando tus documentos. Esto suele tardar unos segundos en sandbox.
            </span>
          </div>
        )}

        {phase === 'verified' && (
          <div className="rounded-lg border border-success-border bg-success-bg p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-success-fg">
              <CheckCircle2 className="h-4 w-4" />
              Verificación aprobada
            </div>
            {applicantId && (
              <p className="mt-1 font-mono text-xs text-foreground-tertiary">
                applicantId · {applicantId}
              </p>
            )}
            {txHash && (
              <a
                href={`https://testnet.snowtrace.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-mono text-xs text-brand-400 underline-offset-4 hover:underline"
              >
                Identity registrada on-chain → {txHash.slice(0, 10)}…
              </a>
            )}
            {!txHash && (
              <p className="mt-2 text-xs text-foreground-tertiary">
                Conecta tu wallet en el siguiente paso para registrar tu identidad on-chain.
              </p>
            )}
          </div>
        )}

        {phase === 'rejected' && (
          <div className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-bg p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" />
            <div>
              <p className="font-medium text-danger-fg">Verificación rechazada</p>
              <p className="mt-1 text-foreground-secondary">
                Sumsub no pudo aprobar la verificación. Vuelve a intentarlo o contacta a soporte.
              </p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={startKyc}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-bg p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" />
            <div className="flex-1">
              <p className="font-medium text-danger-fg">No pudimos abrir Sumsub</p>
              <p className="mt-1 break-words text-xs text-foreground-secondary">
                {errorMessage ?? 'Error desconocido'}
              </p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={startKyc}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-start gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
          <div className="text-foreground-secondary">
            Tus documentos viajan cifrados a Sumsub. Solo el resultado y un claim hash se persisten;
            la PII nunca toca blockchain.
          </div>
        </div>

        {phase === 'verified' && <Badge variant="success">KYC completado</Badge>}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" onClick={() => router.push('/onboarding')}>
          <ChevronLeft />
          Volver
        </Button>
        <Button
          disabled={!ready}
          onClick={() => {
            patch({ step: 2 });
            router.push('/onboarding/wallet');
          }}
        >
          Continuar
          <ChevronRight />
        </Button>
      </CardFooter>
    </Card>
  );
}
