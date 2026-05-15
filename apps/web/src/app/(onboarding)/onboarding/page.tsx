'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@hack/ui';
import { useOnboardingStore } from '@/lib/client/stores/onboardingStore';
import { ChevronRight } from 'lucide-react';

interface FormShape {
  fullName: string;
  rfc: string;
  curp: string;
  dateOfBirth: string;
  accredited: boolean;
}

export default function OnboardingStartPage() {
  const router = useRouter();
  const { fullName, rfc, curp, dateOfBirth, accredited, patch } = useOnboardingStore();

  const { register, handleSubmit, watch, setValue } = useForm<FormShape>({
    defaultValues: { fullName, rfc, curp, dateOfBirth, accredited },
  });

  const isAccredited = watch('accredited');

  const onSubmit = (data: FormShape) => {
    patch({ ...data, step: 1 });
    router.push('/onboarding/kyc');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus datos personales</CardTitle>
        <CardDescription>
          Necesitamos esta información para iniciar tu KYC con Arkangeles ClaimIssuer. No salen de
          la jurisdicción mexicana.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="onboarding-step-1"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-5 sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fullName" required>
              Nombre completo (como aparece en tu identificación)
            </Label>
            <Input
              id="fullName"
              {...register('fullName', { required: true })}
              placeholder="Ana María Rivera Solís"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rfc" required>
              RFC
            </Label>
            <Input id="rfc" {...register('rfc', { required: true })} placeholder="AAAA000000XXX" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="curp" required>
              CURP
            </Label>
            <Input
              id="curp"
              {...register('curp', { required: true })}
              placeholder="AAAA000000HDFXXX00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob" required>
              Fecha de nacimiento
            </Label>
            <Input id="dob" type="date" {...register('dateOfBirth', { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jurisdiction">Jurisdicción fiscal</Label>
            <Input id="jurisdiction" value="México" disabled />
          </div>
          <div className="rounded-lg border border-border-subtle bg-elevated p-4 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Inversionista calificado</p>
                <p className="mt-1 text-xs text-foreground-tertiary">
                  Mantienes inversión mayor a 1.5M UDIs en valores o ingresos sobre 200,000 UDIs
                  últimos 2 años. Te da acceso a más ofertas y montos.
                </p>
              </div>
              <Switch
                checked={isAccredited}
                onCheckedChange={(v) => setValue('accredited', Boolean(v), { shouldDirty: true })}
              />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-foreground-tertiary">Paso 1 de 4</p>
        <Button type="submit" form="onboarding-step-1">
          Continuar a KYC
          <ChevronRight />
        </Button>
      </CardFooter>
    </Card>
  );
}
