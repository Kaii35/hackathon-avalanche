'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { cn } from './lib/cn';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  icon?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  items: CommandItem[];
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({
  items,
  placeholder = 'Buscar acción, oferta o página…',
  open: controlledOpen,
  onOpenChange,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const groups = items.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const g = item.group ?? 'General';
    (acc[g] ??= []).push(item);
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2',
            'overflow-hidden rounded-xl border border-border bg-overlay shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          aria-label="Paleta de comandos"
        >
          <DialogPrimitive.Title className="sr-only">Paleta de comandos</DialogPrimitive.Title>
          <Command label="Paleta de comandos" className="w-full" loop>
            <div className="flex items-center gap-2 border-b border-border-subtle px-4">
              <Search className="h-4 w-4 text-foreground-tertiary" />
              <Command.Input
                placeholder={placeholder}
                className="flex h-12 w-full bg-transparent text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none"
              />
              <kbd className="hidden rounded border border-border-subtle bg-elevated px-1.5 py-0.5 text-2xs text-foreground-tertiary sm:inline-flex">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-foreground-tertiary">
                Sin coincidencias.
              </Command.Empty>
              {Object.entries(groups).map(([groupName, groupItems]) => (
                <Command.Group
                  key={groupName}
                  heading={groupName}
                  className="px-1 pt-2 text-2xs font-medium uppercase tracking-wider text-foreground-tertiary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1"
                >
                  {groupItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.hint ?? ''}`}
                      onSelect={() => {
                        item.onSelect();
                        setOpen(false);
                      }}
                      className={cn(
                        'flex cursor-default items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground',
                        'aria-selected:bg-elevated aria-selected:text-foreground',
                      )}
                    >
                      {item.icon && <span className="text-foreground-tertiary">{item.icon}</span>}
                      <span className="flex-1">{item.label}</span>
                      {item.hint && (
                        <span className="text-xs text-foreground-tertiary">{item.hint}</span>
                      )}
                      {item.shortcut && (
                        <kbd className="rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-2xs text-foreground-tertiary">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
