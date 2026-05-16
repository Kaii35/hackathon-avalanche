'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, MailPlus, Search, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@hack/ui';
import {
  CreateAdminInviteSchema,
  type AdminInviteDto,
  type AdminInviteStatus,
  type CreateAdminInviteDto,
} from '@hack/shared';
import {
  useAdminInvites,
  useCreateAdminInvite,
  useRevokeAdminInvite,
} from '@/lib/client/queries/adminInvites';
import { ApiError } from '@/lib/client/api';

const STATUS_LABEL: Record<AdminInviteStatus, string> = {
  pending: 'Pendiente',
  consumed: 'Consumida',
  revoked: 'Revocada',
};

function statusVariant(status: AdminInviteStatus): 'warning' | 'success' | 'neutral' {
  if (status === 'pending') return 'warning';
  if (status === 'consumed') return 'success';
  return 'neutral';
}

export default function AdminInvitesPage() {
  const { data: invites, isLoading } = useAdminInvites();
  const create = useCreateAdminInvite();
  const revoke = useRevokeAdminInvite();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminInviteStatus>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAdminInviteDto>({
    resolver: zodResolver(CreateAdminInviteSchema),
    defaultValues: { email: '', note: '' },
  });

  const filtered = useMemo(() => {
    let list = invites ?? [];
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.email.toLowerCase().includes(q) ||
          (i.note ?? '').toLowerCase().includes(q) ||
          (i.invitedBy?.email.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [invites, search, statusFilter]);

  const onCreate = async (data: CreateAdminInviteDto) => {
    try {
      await create.mutateAsync(data);
      toast.success(`Invitación creada para ${data.email}`);
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as { error?: { message?: string } } | undefined;
        toast.error(payload?.error?.message ?? `No pudimos crear la invitación (${err.status})`);
      } else {
        toast.error('Error de red al crear la invitación');
      }
    }
  };

  const onRevoke = async (invite: AdminInviteDto) => {
    if (!confirm(`¿Revocar la invitación para ${invite.email}?`)) return;
    try {
      await revoke.mutateAsync(invite.id);
      toast.success('Invitación revocada');
    } catch (err) {
      const message =
        err instanceof ApiError ? `No pudimos revocar (${err.status})` : 'Error de red';
      toast.error(message);
    }
  };

  return (
    <>
      <PageHeader
        title="Invitaciones de administrador"
        description="Pre-aprueba correos para que puedan registrarse como administrador. Solo emails en esta lista pueden completar el registro con rol admin."
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-elevated/40 px-4 py-2.5">
            <div className="relative w-72 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-tertiary" />
              <Input
                placeholder="Buscar correo, nota o invitador…"
                className="h-8 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="consumed">Consumidas</SelectItem>
                <SelectItem value="revoked">Revocadas</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-foreground-tertiary">
              {filtered.length} {filtered.length === 1 ? 'invitación' : 'invitaciones'}
            </span>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="px-6 py-12 text-center text-sm text-foreground-tertiary">
                Cargando invitaciones…
              </div>
            ) : filtered.length === 0 ? (
              <div className="grid place-items-center px-6 py-16 text-center">
                <ShieldCheck className="mb-3 h-8 w-8 text-foreground-tertiary" />
                <p className="text-sm font-medium text-foreground">
                  {invites && invites.length === 0
                    ? 'Aún no hay invitaciones'
                    : 'Sin coincidencias para los filtros'}
                </p>
                <p className="mt-1 text-xs text-foreground-tertiary">
                  Usa el panel de la derecha para pre-aprobar un correo.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {filtered.map((invite) => (
                  <InviteRow key={invite.id} invite={invite} onRevoke={onRevoke} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-brand/10 text-brand">
                <MailPlus className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nueva invitación</p>
                <p className="text-2xs text-foreground-tertiary">Pre-aprueba un correo de admin</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onCreate)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" required>
                  Correo
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  placeholder="nuevo.admin@empresa.mx"
                  {...register('email')}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && <p className="text-2xs text-danger-fg">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-note">Nota (opcional)</Label>
                <Textarea
                  id="invite-note"
                  rows={3}
                  placeholder="Ej: Compliance officer — alta solicitada por dirección"
                  {...register('note')}
                />
                {errors.note && <p className="text-2xs text-danger-fg">{errors.note.message}</p>}
              </div>
              <Button type="submit" loading={create.isPending} className="w-full">
                <MailPlus className="h-4 w-4" />
                Crear invitación
              </Button>
              <p className="text-2xs text-foreground-tertiary">
                Solo el correo invitado puede usar el flujo de registro como administrador. La
                invitación queda en estado <strong>pendiente</strong> hasta que el usuario complete
                su registro.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InviteRow({
  invite,
  onRevoke,
}: {
  invite: AdminInviteDto;
  onRevoke: (invite: AdminInviteDto) => void | Promise<void>;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-start gap-4 px-6 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{invite.email}</span>
          <Badge variant={statusVariant(invite.status)} size="sm">
            {invite.status === 'consumed' && <CheckCircle2 className="h-3 w-3" />}
            {invite.status === 'revoked' && <XCircle className="h-3 w-3" />}
            {STATUS_LABEL[invite.status]}
          </Badge>
        </div>
        {invite.note && <p className="mt-1 text-xs text-foreground-secondary">{invite.note}</p>}
        <p className="mt-1.5 text-2xs text-foreground-tertiary">
          {invite.invitedBy
            ? `Invitada por ${invite.invitedBy.displayName} (${invite.invitedBy.email})`
            : 'Invitada por sistema (seed)'}{' '}
          · creada el {format(new Date(invite.createdAt), 'd MMM yyyy, HH:mm', { locale: es })}
        </p>
        {invite.status === 'consumed' && invite.consumedBy && invite.consumedAt && (
          <p className="mt-0.5 text-2xs text-success-fg">
            Consumida el {format(new Date(invite.consumedAt), 'd MMM yyyy, HH:mm', { locale: es })}{' '}
            por {invite.consumedBy.displayName}
          </p>
        )}
      </div>
      {invite.status === 'pending' && (
        <Button variant="ghost" size="sm" onClick={() => onRevoke(invite)}>
          <Trash2 className="h-4 w-4" />
          Revocar
        </Button>
      )}
    </li>
  );
}
