'use client';

import type { ReactNode } from 'react';
import { TooltipProvider } from '@hack/ui';
import { Toaster } from 'sonner';
import { QueryProvider } from './QueryProvider';
import { Web3Provider } from './Web3Provider';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <Web3Provider>
          <TooltipProvider delayDuration={120} skipDelayDuration={0}>
            {children}
            <Toaster
              theme="system"
              position="top-right"
              toastOptions={{
                className: 'border border-border-subtle bg-elevated text-foreground shadow-md',
              }}
            />
          </TooltipProvider>
        </Web3Provider>
      </QueryProvider>
    </ThemeProvider>
  );
}
