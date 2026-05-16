'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Money,
  PageHeader,
  Stepper,
  Switch,
  Textarea,
} from '@hack/ui';
import { ChevronLeft, ChevronRight, FileUp, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { label: 'Básicos', description: 'Identidad' },
  { label: 'Económicos', description: 'Términos' },
  { label: 'Compliance', description: 'Reglas' },
  { label: 'Documentos', description: 'IPFS' },
  { label: 'Revisión', description: 'Publicar' },
];

interface FormShape {
  name: string;
  symbol: string;
  sector: string;
  description: string;
  totalSupply: string;
  pricePerUnit: string;
  lockupUntil: string;
  maxHolders: number;
  jurisdictionMX: boolean;
  jurisdictionUS: boolean;
  jurisdictionES: boolean;
  accreditedOnly: boolean;
  prospectus: boolean;
  termsheet: boolean;
}

export default function CreateOfferingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const methods = useForm<FormShape>({
    defaultValues: {
      name: '',
      symbol: '',
      sector: 'Crédito Productivo',
      description: '',
      totalSupply: '10000000',
      pricePerUnit: '100.00',
      lockupUntil: new Date(Date.now() + 86400_000 * 365).toISOString().slice(0, 10),
      maxHolders: 200,
      jurisdictionMX: true,
      jurisdictionUS: false,
      jurisdictionES: false,
      accreditedOnly: true,
      prospectus: false,
      termsheet: false,
    },
    mode: 'onTouched',
  });

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  const onPublish = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1100));
    setSubmitting(false);
    toast.success('Oferta publicada y desplegada en Fuji', {
      description: `Token deployado en 0x4b3c…6b5c`,
    });
    router.push('/issuer/offerings');
  };

  return (
    <FormProvider {...methods}>
      <PageHeader
        title="Crear nueva oferta"
        description="Configura la emisión completa: tokenomics, compliance y documentos."
        breadcrumbs={[{ label: 'Mis ofertas', href: '/issuer/offerings' }, { label: 'Nueva' }]}
      />
      <Stepper steps={STEPS} current={stepIdx} className="mb-8" />

      <Card>
        {stepIdx === 0 && <BasicStep />}
        {stepIdx === 1 && <EconomicsStep />}
        {stepIdx === 2 && <ComplianceStep />}
        {stepIdx === 3 && <DocumentsStep />}
        {stepIdx === 4 && <ReviewStep />}

        <CardFooter>
          <Button variant="ghost" onClick={prev} disabled={stepIdx === 0}>
            <ChevronLeft />
            Atrás
          </Button>
          {stepIdx < STEPS.length - 1 ? (
            <Button onClick={next}>
              Siguiente
              <ChevronRight />
            </Button>
          ) : (
            <Button onClick={onPublish} loading={submitting}>
              <Sparkles className="h-4 w-4" />
              Publicar y deployar
            </Button>
          )}
        </CardFooter>
      </Card>
    </FormProvider>
  );
}

function BasicStep() {
  const { register } = useFormContext<FormShape>();
  return (
    <>
      <CardHeader>
        <CardTitle>Información básica</CardTitle>
        <CardDescription>Identidad de la oferta y descripción para inversionistas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name" required>
            Nombre de la oferta
          </Label>
          <Input
            id="name"
            placeholder="Crédito PYME Series B"
            {...register('name', { required: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="symbol" required>
            Símbolo
          </Label>
          <Input
            id="symbol"
            placeholder="AKAPYM"
            maxLength={10}
            {...register('symbol', { required: true })}
            onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sector">Sector</Label>
          <select
            id="sector"
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            {...register('sector')}
          >
            {[
              'Crédito Productivo',
              'Bienes Raíces',
              'Energía / Agro',
              'Venture Capital',
              'Infraestructura',
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description" required>
            Descripción
          </Label>
          <Textarea
            id="description"
            rows={5}
            placeholder="Describe el subyacente, riesgo objetivo, retorno esperado y diferenciador."
            {...register('description', { required: true })}
          />
          <p className="text-xs text-foreground-tertiary">
            Mínimo 20 caracteres. Esta descripción se muestra en el marketplace.
          </p>
        </div>
      </CardContent>
    </>
  );
}

function EconomicsStep() {
  const { register, watch } = useFormContext<FormShape>();
  const supply = Number(watch('totalSupply') ?? 0);
  const price = Number(watch('pricePerUnit') ?? 0);
  return (
    <>
      <CardHeader>
        <CardTitle>Términos económicos</CardTitle>
        <CardDescription>
          Supply, precio y lockup. Definen el tamaño y liquidez inicial.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="totalSupply" required>
            Supply total
          </Label>
          <Input
            id="totalSupply"
            type="number"
            min="1"
            {...register('totalSupply', { required: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricePerUnit" required>
            Precio por unidad (USDC)
          </Label>
          <Input
            id="pricePerUnit"
            type="number"
            step="0.01"
            min="0.01"
            {...register('pricePerUnit', { required: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lockupUntil" required>
            Lockup hasta
          </Label>
          <Input id="lockupUntil" type="date" {...register('lockupUntil', { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxHolders" required>
            Máximo de holders
          </Label>
          <Input
            id="maxHolders"
            type="number"
            min="1"
            max="2000"
            {...register('maxHolders', { required: true, valueAsNumber: true })}
          />
        </div>
        <div className="rounded-lg border border-border-subtle bg-elevated p-4 sm:col-span-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-secondary">Valoración total estimada</span>
            <span className="text-lg font-semibold">
              <Money value={supply * price} currency="USDC" />
            </span>
          </div>
        </div>
      </CardContent>
    </>
  );
}

function ComplianceStep() {
  const { register, watch, setValue } = useFormContext<FormShape>();
  const accredited = watch('accreditedOnly');
  return (
    <>
      <CardHeader>
        <CardTitle>Compliance</CardTitle>
        <CardDescription>
          Estas reglas viven en los smart contracts y son obligatorias en cada transferencia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Jurisdicciones permitidas</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: 'jurisdictionMX' as const, label: 'México 🇲🇽' },
              { id: 'jurisdictionUS' as const, label: 'Estados Unidos 🇺🇸' },
              { id: 'jurisdictionES' as const, label: 'España 🇪🇸' },
            ].map((j) => (
              <label
                key={j.id}
                className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-elevated p-3 text-sm"
              >
                <Checkbox {...register(j.id)} />
                {j.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-elevated p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Solo inversionistas calificados</p>
              <p className="mt-0.5 text-xs text-foreground-tertiary">
                Bloquea transferencias a wallets no acreditadas en IdentityRegistry.
              </p>
            </div>
            <Switch
              checked={accredited}
              onCheckedChange={(v) => setValue('accreditedOnly', Boolean(v), { shouldDirty: true })}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg p-4 text-xs text-foreground-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info-fg" />
          Estas reglas se traducen automáticamente a módulos de compliance: JurisdictionModule,
          MaxHoldersModule, HoldingPeriodModule.
        </div>
      </CardContent>
    </>
  );
}

function DocumentsStep() {
  const { watch, setValue } = useFormContext<FormShape>();
  const prospectus = watch('prospectus');
  const termsheet = watch('termsheet');
  const [filenames, setFilenames] = useState<Record<'prospectus' | 'termsheet', string | null>>({
    prospectus: null,
    termsheet: null,
  });

  return (
    <>
      <CardHeader>
        <CardTitle>Documentos</CardTitle>
        <CardDescription>
          Selecciona los documentos relevantes; se anclan a IPFS y su hash queda on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(
          [
            {
              key: 'prospectus',
              label: 'Prospecto',
              desc: 'PDF — requerido por CNBV',
              value: prospectus,
            },
            {
              key: 'termsheet',
              label: 'Term sheet',
              desc: 'Resumen económico breve',
              value: termsheet,
            },
          ] as const
        ).map((d) => (
          <DocumentRow
            key={d.key}
            field={d.key}
            label={d.label}
            description={d.desc}
            uploaded={d.value}
            filename={filenames[d.key]}
            onFileSelected={(name) => {
              setFilenames((prev) => ({ ...prev, [d.key]: name }));
              setValue(d.key, true, { shouldDirty: true });
            }}
            onRemove={() => {
              setFilenames((prev) => ({ ...prev, [d.key]: null }));
              setValue(d.key, false, { shouldDirty: true });
            }}
          />
        ))}
      </CardContent>
    </>
  );
}

function DocumentRow({
  field,
  label,
  description,
  uploaded,
  filename,
  onFileSelected,
  onRemove,
}: {
  field: 'prospectus' | 'termsheet';
  label: string;
  description: string;
  uploaded: boolean;
  filename: string | null;
  onFileSelected: (name: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-dashed border-border bg-elevated/40 p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-elevated">
          <FileUp className="h-5 w-5 text-foreground-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-foreground-tertiary">
            {filename ? filename : description}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          aria-label={`Adjuntar ${label}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file.name);
            // Allow re-selecting the same file later
            e.target.value = '';
          }}
        />
        {uploaded ? (
          <div className="flex items-center gap-2">
            <Badge variant="success">Subido a IPFS</Badge>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Quitar
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            data-field={field}
          >
            Adjuntar PDF
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewStep() {
  const { watch } = useFormContext<FormShape>();
  const f = watch();
  return (
    <>
      <CardHeader>
        <CardTitle>Revisión final</CardTitle>
        <CardDescription>Verifica los términos antes de deployar el SecurityToken.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewItem label="Nombre" value={f.name || '—'} />
          <ReviewItem label="Símbolo" value={f.symbol || '—'} />
          <ReviewItem label="Sector" value={f.sector} />
          <ReviewItem label="Supply" value={Number(f.totalSupply || 0).toLocaleString('es-MX')} />
          <ReviewItem label="Precio" value={`${f.pricePerUnit} USDC`} />
          <ReviewItem label="Lockup" value={f.lockupUntil} />
          <ReviewItem label="Max holders" value={f.maxHolders.toString()} />
          <ReviewItem
            label="Jurisdicciones"
            value={
              [f.jurisdictionMX && 'MX', f.jurisdictionUS && 'US', f.jurisdictionES && 'ES']
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
          <ReviewItem label="Solo calificados" value={f.accreditedOnly ? 'Sí' : 'No'} />
          <ReviewItem
            label="Documentos"
            value={
              [f.prospectus && 'Prospecto', f.termsheet && 'Term sheet']
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
        </div>
        <div className="mt-6 rounded-lg border border-warning-border bg-warning-bg p-4 text-xs text-warning-fg">
          Al publicar, se ejecuta TokenFactory.deployToken() — operación irreversible en Fuji.
        </div>
      </CardContent>
    </>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-elevated p-3">
      <p className="text-2xs uppercase tracking-wider text-foreground-tertiary">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
