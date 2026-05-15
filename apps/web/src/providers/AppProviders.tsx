'use client';

import type { ReactNode } from 'react';
import { TooltipProvider } from '@hack/ui';
import { Toaster } from 'sonner';
import { QueryProvider } from './QueryProvider';
import { Web3Provider } from './Web3Provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <Web3Provider>
        <TooltipProvider delayDuration={120} skipDelayDuration={0}>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(222 18% 10%)',
                border: '1px solid hsl(222 14% 18%)',
                color: 'hsl(0 0% 98%)',
              },
            }}
          />
        </TooltipProvider>
      </Web3Provider>
    </QueryProvider>
  );
}
