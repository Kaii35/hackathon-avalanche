import { Check } from 'lucide-react';
import { cn } from './lib/cn';

export interface StepperStep {
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex w-full items-start gap-2', className)}>
      {steps.map((step, idx) => {
        const status = idx < current ? 'done' : idx === current ? 'active' : 'upcoming';
        return (
          <li key={step.label} className="flex-1">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  status === 'done' && 'border-brand bg-brand text-white',
                  status === 'active' && 'border-brand bg-brand/15 text-brand-400',
                  status === 'upcoming' &&
                    'border-border-strong bg-surface text-foreground-tertiary',
                )}
              >
                {status === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'h-px flex-1 transition-colors',
                    status === 'done' ? 'bg-brand' : 'bg-border-subtle',
                  )}
                />
              )}
            </div>
            <div className="mt-2">
              <p
                className={cn(
                  'text-xs font-medium',
                  status === 'upcoming' ? 'text-foreground-tertiary' : 'text-foreground',
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-xs text-foreground-tertiary">{step.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
