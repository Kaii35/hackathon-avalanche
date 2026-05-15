'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { ChevronLeft, ChevronRight, FileCheck2, FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';

interface UploaderProps {
  label: string;
  description: string;
  uploaded: boolean;
  onUpload: () => void;
}

function Uploader({ label, description, uploaded, onUpload }: UploaderProps) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1100));
    setBusy(false);
    onUpload();
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-elevated/40 p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-elevated text-foreground-secondary">
          {uploaded ? (
            <FileCheck2 className="h-5 w-5 text-success-fg" />
          ) : (
            <FileUp className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-foreground-tertiary">{description}</p>
        </div>
        {uploaded ? (
          <Badge variant="success">Subido</Badge>
        ) : (
          <Button variant="secondary" size="sm" onClick={handle} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo
              </>
            ) : (
              'Subir'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function KycPage() {
  const router = useRouter();
  const { documentUploaded, proofUploaded, patch } = useOnboardingStore();

  const ready = documentUploaded && proofUploaded;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verificación de identidad</CardTitle>
        <CardDescription>
          Sube los documentos requeridos. Tu KYC quedará firmado on-chain por Arkangeles ClaimIssuer
          y será reusable en todas las ofertas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Uploader
          label="Identificación oficial vigente"
          description="INE, pasaporte o licencia de conducir. PDF o JPG hasta 5 MB."
          uploaded={documentUploaded}
          onUpload={() => patch({ documentUploaded: true })}
        />
        <Uploader
          label="Comprobante de domicilio (≤ 3 meses)"
          description="CFE, agua, predio o estado de cuenta bancario."
          uploaded={proofUploaded}
          onUpload={() => patch({ proofUploaded: true })}
        />

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
          <div className="text-foreground-secondary">
            Tus documentos viajan cifrados a la IFC. Solo se almacena el hash del claim en
            blockchain — nunca la PII bruta.
          </div>
        </div>
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
