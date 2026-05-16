'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '@hack/ui';
import { Lock, Save } from 'lucide-react';
import {
  UpdateOfferingSchema,
  type OfferingResponseDto,
  type UpdateOfferingDto,
  JURISDICTION_MX,
} from '@hack/shared';
import { ApiError } from '@/lib/client/api';
import { useUpdateOffering } from '@/lib/client/queries/offerings';

const JURISDICTION_US = 840;
const JURISDICTION_ES = 724;

const STATUS_OPTIONS = [
  { value: 'draft' as const, label: 'Borrador' },
  { value: 'active' as const, label: 'Activa' },
  { value: 'closed' as const, label: 'Cerrada' },
];

const SECTOR_OPTIONS = [
  'Crédito Productivo',
  'Bienes Raíces',
  'Energía / Agro',
  'Venture Capital',
  'Infraestructura',
];

interface Props {
  offering: OfferingResponseDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditOfferingSheet({ offering, open, onOpenChange }: Props) {
  const update = useUpdateOffering(offering.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateOfferingDto>({
    resolver: zodResolver(UpdateOfferingSchema),
    defaultValues: {
      name: offering.name,
      description: offering.description,
      sector: offering.sector,
      prospectusIpfs: offering.prospectusIpfs ?? '',
      pricePerUnit: offering.pricePerUnit,
      maxHolders: offering.maxHolders,
      allowedJurisdictions: offering.allowedJurisdictions,
      status: offering.status,
    },
  });

  // Reset when a different offering is opened
  useEffect(() => {
    reset({
      name: offering.name,
      description: offering.description,
      sector: offering.sector,
      prospectusIpfs: offering.prospectusIpfs ?? '',
      pricePerUnit: offering.pricePerUnit,
      maxHolders: offering.maxHolders,
      allowedJurisdictions: offering.allowedJurisdictions,
      status: offering.status,
    });
  }, [offering.id, reset]);

  const jurisdictions = watch('allowedJurisdictions') ?? [];
  const toggleJurisdiction = (code: number) => {
    const current = new Set(jurisdictions);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    setValue('allowedJurisdictions', Array.from(current), { shouldDirty: true });
  };

  const onSubmit = async (data: UpdateOfferingDto) => {
    try {
      // Send only fields that changed (compared to original).
      const diff: UpdateOfferingDto = {};
      if (data.name !== offering.name) diff.name = data.name;
      if (data.description !== offering.description) diff.description = data.description;
      if (data.sector !== offering.sector) diff.sector = data.sector;
      if ((data.prospectusIpfs ?? '') !== (offering.prospectusIpfs ?? ''))
        diff.prospectusIpfs = data.prospectusIpfs ?? '';
      if (data.pricePerUnit !== offering.pricePerUnit) diff.pricePerUnit = data.pricePerUnit;
      if (data.maxHolders !== offering.maxHolders) diff.maxHolders = data.maxHolders;
      if (
        JSON.stringify(data.allowedJurisdictions) !== JSON.stringify(offering.allowedJurisdictions)
      )
        diff.allowedJurisdictions = data.allowedJurisdictions;
      if (data.status !== offering.status) diff.status = data.status;

      if (Object.keys(diff).length === 0) {
        toast.info('Nada que actualizar');
        return;
      }

      await update.mutateAsync(diff);
      toast.success('Oferta actualizada');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as { error?: { message?: string } } | undefined;
        toast.error(payload?.error?.message ?? `No pudimos actualizar (HTTP ${err.status})`);
      } else {
        toast.error(err instanceof Error ? err.message : 'Error al guardar.');
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Editar oferta</SheetTitle>
          <SheetDescription>
            Los campos on-chain (símbolo, supply total, lockup, dirección del token) son inmutables.
            Aquí editas la metadata visible para inversionistas.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 space-y-5 overflow-y-auto px-6 py-4"
        >
          <ImmutableSummary offering={offering} />

          <div className="space-y-1.5">
            <Label htmlFor="edit-name" required>
              Nombre
            </Label>
            <Input id="edit-name" {...register('name')} invalid={Boolean(errors.name)} />
            {errors.name && <p className="text-xs text-danger-fg">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-sector">Sector</Label>
            <select
              id="edit-sector"
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              {...register('sector')}
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description" required>
              Descripción
            </Label>
            <Textarea
              id="edit-description"
              rows={5}
              {...register('description')}
              invalid={Boolean(errors.description)}
            />
            <p className="text-2xs text-foreground-tertiary">
              {(watch('description') ?? '').length} caracteres
            </p>
            {errors.description && (
              <p className="text-xs text-danger-fg">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Precio por unidad (USDC)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                {...register('pricePerUnit')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-max">Max holders</Label>
              <Input
                id="edit-max"
                type="number"
                min="1"
                max="2000"
                {...register('maxHolders', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Jurisdicciones permitidas</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: JURISDICTION_MX, label: '🇲🇽 México' },
                { code: JURISDICTION_US, label: '🇺🇸 Estados Unidos' },
                { code: JURISDICTION_ES, label: '🇪🇸 España' },
              ].map((j) => {
                const active = jurisdictions.includes(j.code);
                return (
                  <button
                    key={j.code}
                    type="button"
                    onClick={() => toggleJurisdiction(j.code)}
                    className={
                      active
                        ? 'rounded-md border border-brand/40 bg-brand/10 px-2 py-2 text-xs font-medium text-brand-400'
                        : 'rounded-md border border-border-subtle bg-elevated px-2 py-2 text-xs text-foreground-tertiary hover:border-border'
                    }
                  >
                    {j.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-prospectus">Prospecto IPFS (CID, URL o referencia)</Label>
            <Input
              id="edit-prospectus"
              placeholder="bafy... o https://ipfs.io/ipfs/..."
              {...register('prospectusIpfs')}
            />
            <p className="text-2xs text-foreground-tertiary">
              Pinata real está pendiente — por ahora se almacena como string.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Estado</Label>
            <select
              id="edit-status"
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              {...register('status')}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="text-2xs text-foreground-tertiary">
              Cerrar una oferta la oculta del marketplace; el token sigue tradeable.
            </p>
          </div>
        </form>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={update.isPending} disabled={!isDirty}>
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Read-only block showing the on-chain immutable fields so the issuer remembers
 * what they can't change here.
 */
function ImmutableSummary({ offering }: { offering: OfferingResponseDto }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-elevated/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
        <Lock className="size-3" />
        Inmutable on-chain
      </div>
      <dl className="space-y-1 text-xs">
        <Row
          label="Símbolo"
          value={
            <Badge variant="outline" size="sm">
              {offering.symbol}
            </Badge>
          }
        />
        <Row label="Supply total" value={Number(offering.totalSupply).toLocaleString('es-MX')} />
        <Row
          label="Lockup hasta"
          value={new Date(offering.lockupUntil).toLocaleDateString('es-MX')}
        />
        <Row
          label="Token"
          value={
            offering.tokenAddress ? (
              <span className="font-mono text-2xs">
                {offering.tokenAddress.slice(0, 8)}…{offering.tokenAddress.slice(-6)}
              </span>
            ) : (
              <span className="text-foreground-tertiary">— sin deploy</span>
            )
          }
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-foreground-tertiary">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
