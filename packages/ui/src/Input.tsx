import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2',
        'text-sm text-foreground placeholder:text-foreground-tertiary',
        'transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:border-brand/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-danger/60 focus-visible:ring-danger/50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
