import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-elevated border-border-subtle text-foreground-secondary',
        success: 'bg-success-bg border-success-border text-success-fg',
        warning: 'bg-warning-bg border-warning-border text-warning-fg',
        danger: 'bg-danger-bg border-danger-border text-danger-fg',
        info: 'bg-info-bg border-info-border text-info-fg',
        brand: 'bg-brand/10 border-brand/30 text-brand-400',
        outline: 'bg-transparent border-border text-foreground-secondary',
      },
      size: {
        sm: 'text-2xs px-1.5 py-0',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-2.5 py-1',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
