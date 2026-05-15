'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  WalletAddress,
} from '@hack/ui';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useAuditLog } from '@/lib/client/queries/admin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AuditLogEntryDto } from '@hack/shared';

export default function AuditLogPage() {
  const { data } = useAuditLog();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actions = Array.from(new Set((data ?? []).map((a) => a.action)));

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (action !== 'all') list = list.filter((a) => a.action === action);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.actor.toLowerCase().includes(q) ||
          (a.target ?? '').toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search, action]);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Registro inmutable de todas las acciones administrativas y regulatorias."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-elevated/40 px-4 py-2.5">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-tertiary" />
            <Input
              placeholder="Buscar actor, target o acción…"
              className="h-8 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-8 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-subtle">
            {filtered.map((entry) => (
              <AuditRow
                key={entry.id}
                entry={entry}
                expanded={expanded.has(entry.id)}
                onToggle={() => toggle(entry.id)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function AuditRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntryDto;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-elevated/40"
      >
        <span className="text-foreground-tertiary">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="sm">
              {entry.action.replace(/_/g, ' ')}
            </Badge>
            <span className="text-sm font-medium">{entry.actor}</span>
            {entry.target && (
              <span className="font-mono text-xs text-foreground-tertiary">
                → {entry.target.slice(0, 12)}…
              </span>
            )}
          </div>
          {entry.txHash && (
            <p className="mt-1 truncate font-mono text-2xs text-foreground-tertiary">
              tx: {entry.txHash.slice(0, 18)}…
            </p>
          )}
        </div>
        <span className="text-2xs text-foreground-tertiary tabular">
          {format(new Date(entry.createdAt), 'd MMM, HH:mm', { locale: es })}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border-subtle bg-canvas/40 px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                Target
              </p>
              {entry.target && (
                <div className="mt-1">
                  <WalletAddress address={entry.target} />
                </div>
              )}
            </div>
            {entry.txHash && (
              <div>
                <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
                  Tx hash
                </p>
                <a
                  href={`https://testnet.snowtrace.io/tx/${entry.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex font-mono text-xs text-brand-400 hover:text-brand-300"
                >
                  {entry.txHash}
                </a>
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-2xs font-medium uppercase tracking-wider text-foreground-tertiary">
              Payload
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-border-subtle bg-canvas p-3 font-mono text-xs text-foreground-secondary">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </div>
          <div className="mt-3">
            <Button variant="ghost" size="sm">
              Copiar JSON
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
