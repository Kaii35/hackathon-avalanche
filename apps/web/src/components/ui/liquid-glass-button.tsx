'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@hack/ui';

/**
 * Liquid Glass + Metal buttons.
 * Adapted from the prompt component:
 *  - Uses our `cn` from `@hack/ui` (single source of truth).
 *  - Drops the duplicate "Button" export — we already export Button from @hack/ui
 *    for forms/UI; this file only adds the heavy "showcase" variants.
 *  - Replaces Tailwind 4-only utilities (`bg-linear-to-t`, `inset-shadow-*`)
 *    with Tailwind 3 equivalents (`bg-gradient-to-t`, arbitrary inset shadows).
 *  - Uses our brand token (text-foreground / ring-brand) instead of the
 *    shadcn `primary` / `ring` tokens that don't exist here.
 *  - Generates a unique filter id per instance (`useId`) so multiple
 *    Liquid buttons on the same page don't fight over `#container-glass`.
 *
 * The Liquid Glass effect uses an SVG `feTurbulence` + `feDisplacementMap`
 * filter wired to `backdrop-filter`. It distorts whatever is *behind* the
 * button — works great over the cosmic Hero canvas, looks subtle on flat
 * surfaces. Reach for it on prominent CTAs, not on every action.
 */

export const liquidButtonVariants = cva(
  [
    'inline-flex items-center transition-colors justify-center cursor-pointer gap-2',
    'whitespace-nowrap rounded-md text-sm font-medium',
    'transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    'outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent hover:scale-105 duration-300 transition text-foreground',
        brand: 'bg-transparent hover:scale-105 duration-300 transition text-foreground',
        destructive: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 text-xs gap-1.5 px-4',
        md: 'h-10 px-4 py-2 has-[>svg]:px-3',
        lg: 'h-11 rounded-md px-6 has-[>svg]:px-4',
        xl: 'h-12 rounded-md px-8 has-[>svg]:px-6',
        xxl: 'h-14 rounded-md px-10 has-[>svg]:px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'lg',
    },
  },
);

export interface LiquidButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidButtonVariants> {}

/**
 * NOTE: no `asChild` support — the button has multiple absolute layers and
 * Radix Slot requires a single child. For navigation, use `onClick` with
 * `useRouter().push(...)` from `next/navigation`.
 */
export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  function LiquidButton({ className, variant, size, children, ...props }, ref) {
    const filterId = React.useId().replace(/:/g, '');
    const filterRef = `glass-${filterId}`;

    return (
      <button
        ref={ref}
        data-slot="liquid-button"
        className={cn('relative', liquidButtonVariants({ variant, size, className }))}
        {...props}
      >
        {/* Inset highlight ring — heavy frosted-glass shadow stack */}
        <div
          className="absolute inset-0 z-0 rounded-md transition-all
          shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)]
          dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]"
        />
        {/* Backdrop displacement layer — distorts what's behind the button */}
        <div
          className="absolute inset-0 isolate -z-10 overflow-hidden rounded-md"
          style={{ backdropFilter: `url("#${filterRef}")`, WebkitBackdropFilter: 'blur(2px)' }}
        />
        <div className="pointer-events-none z-10 inline-flex items-center gap-2">{children}</div>
        <GlassFilter id={filterRef} />
      </button>
    );
  },
);

function GlassFilter({ id }: { id: string }) {
  return (
    <svg className="hidden" aria-hidden focusable="false">
      <defs>
        <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

/* ─────────────────────────── Metal Button ─────────────────────────── */

type MetalColorVariant = 'default' | 'primary' | 'success' | 'error' | 'gold' | 'bronze';

interface MetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MetalColorVariant;
}

const metalColorVariants: Record<
  MetalColorVariant,
  {
    outer: string;
    inner: string;
    button: string;
    textColor: string;
    textShadow: string;
  }
> = {
  default: {
    outer: 'bg-gradient-to-b from-[#000] to-[#A0A0A0]',
    inner: 'bg-gradient-to-b from-[#FAFAFA] via-[#3E3E3E] to-[#E5E5E5]',
    button: 'bg-gradient-to-b from-[#B9B9B9] to-[#969696]',
    textColor: 'text-white',
    textShadow: '[text-shadow:_0_-1px_0_rgb(80_80_80_/_100%)]',
  },
  primary: {
    // Arkangeles brand metal: deep navy outline, electric blue body.
    outer: 'bg-gradient-to-b from-[#081133] to-[#5C82FF]',
    inner: 'bg-gradient-to-b from-[#D9E2FF] via-[#163399] to-[#B3C5FF]',
    button: 'bg-gradient-to-b from-[#5C82FF] to-[#163399]',
    textColor: 'text-white',
    textShadow: '[text-shadow:_0_-1px_0_rgb(15_34_102_/_100%)]',
  },
  success: {
    outer: 'bg-gradient-to-b from-[#005A43] to-[#7CCB9B]',
    inner: 'bg-gradient-to-b from-[#E5F8F0] via-[#00352F] to-[#D1F0E6]',
    button: 'bg-gradient-to-b from-[#9ADBC8] to-[#3E8F7C]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(6_78_59_/_100%)]',
  },
  error: {
    outer: 'bg-gradient-to-b from-[#5A0000] to-[#FFAEB0]',
    inner: 'bg-gradient-to-b from-[#FFDEDE] via-[#680002] to-[#FFE9E9]',
    button: 'bg-gradient-to-b from-[#F08D8F] to-[#A45253]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(146_64_14_/_100%)]',
  },
  gold: {
    outer: 'bg-gradient-to-b from-[#917100] to-[#EAD98F]',
    inner: 'bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]',
    button: 'bg-gradient-to-b from-[#FFEBA1] to-[#9B873F]',
    textColor: 'text-[#FFFDE5]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(178_140_2_/_100%)]',
  },
  bronze: {
    outer: 'bg-gradient-to-b from-[#864813] to-[#E9B486]',
    inner: 'bg-gradient-to-b from-[#EDC5A1] via-[#5F2D01] to-[#FFDEC1]',
    button: 'bg-gradient-to-b from-[#FFE3C9] to-[#A36F3D]',
    textColor: 'text-[#FFF7F0]',
    textShadow: '[text-shadow:_0_-1px_0_rgb(124_45_18_/_100%)]',
  },
};

const metalButtonVariants = (
  variant: MetalColorVariant,
  isPressed: boolean,
  isHovered: boolean,
  isTouchDevice: boolean,
) => {
  const colors = metalColorVariants[variant];
  const transitionStyle = 'all 250ms cubic-bezier(0.1, 0.4, 0.2, 1)';
  return {
    wrapper: cn(
      'relative inline-flex transform-gpu rounded-md p-[1.25px] will-change-transform',
      colors.outer,
    ),
    wrapperStyle: {
      transform: isPressed ? 'translateY(2.5px) scale(0.99)' : 'translateY(0) scale(1)',
      boxShadow: isPressed
        ? '0 1px 2px rgba(0, 0, 0, 0.15)'
        : isHovered && !isTouchDevice
          ? '0 4px 12px rgba(0, 0, 0, 0.12)'
          : '0 3px 8px rgba(0, 0, 0, 0.08)',
      transition: transitionStyle,
      transformOrigin: 'center center',
    },
    inner: cn('absolute inset-[1px] transform-gpu rounded-lg will-change-transform', colors.inner),
    innerStyle: {
      transition: transitionStyle,
      transformOrigin: 'center center',
      filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.05)' : 'none',
    },
    button: cn(
      'relative z-10 m-[1px] inline-flex h-11 transform-gpu cursor-pointer items-center justify-center overflow-hidden rounded-md px-6 py-2 text-sm leading-none font-semibold will-change-transform outline-none',
      colors.button,
      colors.textColor,
      colors.textShadow,
    ),
    buttonStyle: {
      transform: isPressed ? 'scale(0.97)' : 'scale(1)',
      transition: transitionStyle,
      transformOrigin: 'center center',
      filter: isHovered && !isPressed && !isTouchDevice ? 'brightness(1.02)' : 'none',
    },
  };
};

function ShineEffect({ isPressed }: { isPressed: boolean }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-300',
        isPressed ? 'opacity-20' : 'opacity-0',
      )}
    >
      <div className="absolute inset-0 rounded-md bg-gradient-to-r from-transparent via-neutral-100 to-transparent" />
    </div>
  );
}

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ children, className, variant = 'primary', ...props }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);

    React.useEffect(() => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    const variants = metalButtonVariants(variant, isPressed, isHovered, isTouchDevice);

    return (
      <div className={variants.wrapper} style={variants.wrapperStyle}>
        <div className={variants.inner} style={variants.innerStyle} />
        <button
          ref={ref}
          className={cn(variants.button, className)}
          style={variants.buttonStyle}
          {...props}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => {
            setIsPressed(false);
            setIsHovered(false);
          }}
          onMouseEnter={() => {
            if (!isTouchDevice) setIsHovered(true);
          }}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          onTouchCancel={() => setIsPressed(false)}
        >
          <ShineEffect isPressed={isPressed} />
          {children}
          {isHovered && !isPressed && !isTouchDevice && (
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-transparent to-white/5" />
          )}
        </button>
      </div>
    );
  },
);
MetalButton.displayName = 'MetalButton';
