import { cn } from '@hack/ui';

interface MarkProps {
  size?: number;
  className?: string;
  /** Add the brand glow shadow under the mark. Useful in hero / loading screens. */
  glow?: boolean;
}

/**
 * Logo mark only — three ascending bars in Arkangeles brand blue.
 * The shape says "market depth / tokenized growth" without using the
 * generic triangle/square placeholder. Scales cleanly from 16px (favicon)
 * to 64px+ (loading screen).
 */
export function LogoMark({ size = 28, className, glow = false }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(glow && 'drop-shadow-[0_0_10px_rgba(42,91,255,0.45)]', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="logo-mark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C82FF" />
          <stop offset="100%" stopColor="#163399" />
        </linearGradient>
      </defs>
      <rect
        x="4"
        y="19"
        width="5"
        height="9"
        rx="1.6"
        fill="url(#logo-mark-gradient)"
        opacity="0.55"
      />
      <rect
        x="13"
        y="12"
        width="5"
        height="16"
        rx="1.6"
        fill="url(#logo-mark-gradient)"
        opacity="0.8"
      />
      <rect x="22" y="4" width="5" height="24" rx="1.6" fill="url(#logo-mark-gradient)" />
    </svg>
  );
}

interface LogoProps extends MarkProps {
  /** Show the wordmark next to the symbol. Default: true. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
}

/**
 * Brand lockup: mark + wordmark "ARCA". Drop into nav/footer/loading.
 * Wordmark uses ALL CAPS + wider tracking — a 4-letter brand earns the
 * impact of a full all-caps treatment without dragging on (e.g. "ARCA"
 * vs the longer "Arca" in body copy elsewhere).
 */
export function Logo({
  size = 24,
  className,
  glow = false,
  withWordmark = true,
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} glow={glow} />
      {withWordmark && (
        <span
          className={cn(
            'font-semibold uppercase tracking-[0.18em] text-foreground',
            wordmarkClassName,
          )}
        >
          ARCA
        </span>
      )}
    </span>
  );
}
