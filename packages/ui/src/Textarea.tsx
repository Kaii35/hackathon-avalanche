import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex min-h-[88px] w-full rounded-md border border-border bg-surface px-3 py-2',
        'text-sm text-foreground placeholder:text-foreground-tertiary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:border-brand/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-danger/60 focus-visible:ring-danger/50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
