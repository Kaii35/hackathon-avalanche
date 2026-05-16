'use client';

import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

/**
 * Animated Theme Toggler — sun ↔ moon morph with spring physics.
 *
 * Source design by the prompt provider. Adapted to:
 *   • Use `framer-motion` (API-compatible with `motion/react`) — already in deps.
 *   • Use `next-themes` for state (persisted, SSR-safe) instead of mutating
 *     `document.documentElement.classList` directly. Otherwise the toggle would
 *     fight the ThemeProvider on every render and lose the user's choice on reload.
 */

export interface AnimatedThemeTogglerProps {
  /** Play a soft switch-click on toggle. Default: true. */
  sound?: boolean;
  className?: string;
}

let _ctx: AudioContext | null = null;
let _buf: AudioBuffer | null = null;

function audioCtx(): AudioContext {
  if (!_ctx) {
    const W = window as unknown as {
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) throw new Error('AudioContext unsupported');
    _ctx = new Ctor();
  }
  if (_ctx.state === 'suspended') void _ctx.resume();
  return _ctx;
}

function ensureBuf(ac: AudioContext): AudioBuffer {
  if (_buf && _buf.sampleRate === ac.sampleRate) return _buf;
  const rate = ac.sampleRate;
  const len = Math.floor(rate * 0.006);
  const buf = ac.createBuffer(1, len, rate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const sine = Math.sin(2 * Math.PI * 3400 * t);
    const noise = Math.random() * 2 - 1;
    ch[i] = (sine * 0.6 + noise * 0.4) * (1 - t) ** 3;
  }
  _buf = buf;
  return buf;
}

function tick(last: MutableRefObject<number>) {
  const now = performance.now();
  if (now - last.current < 80) return;
  last.current = now;
  try {
    const ac = audioCtx();
    const buf = ensureBuf(ac);
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    src.buffer = buf;
    gain.gain.value = 0.08;
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
  } catch {
    // silent
  }
}

export function AnimatedThemeToggler({ sound = true, className }: AnimatedThemeTogglerProps) {
  const rawId = useId();
  const maskId = `att${rawId.replace(/:/g, '')}`;
  const lastSnd = useRef(0);
  const isFirst = useRef(true);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => {
      isFirst.current = false;
    });
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const label = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
    if (sound) tick(lastSnd);
  };

  const spring = isFirst.current
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 30 };

  return (
    <motion.button
      onClick={handleToggle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label={label}
      title={label}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'currentColor',
        borderRadius: 8,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <motion.svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ rotate: isDark ? 270 : 0 }}
        transition={spring}
        style={{ overflow: 'visible' }}
        aria-hidden
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <motion.circle
            initial={false}
            animate={{ cx: isDark ? 17 : 33, cy: isDark ? 8 : 0 }}
            transition={spring}
            r="9"
            fill="black"
          />
        </mask>

        <motion.circle
          cx="12"
          cy="12"
          fill="currentColor"
          stroke="none"
          mask={`url(#${maskId})`}
          initial={false}
          animate={{ r: isDark ? 9 : 5 }}
          transition={spring}
        />

        <motion.g
          initial={false}
          animate={{
            opacity: isDark ? 0 : 1,
            scale: isDark ? 0 : 1,
            rotate: isDark ? -30 : 0,
          }}
          transition={spring}
          style={{ transformOrigin: '12px 12px' }}
        >
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="5.64" y1="5.64" x2="4.22" y2="4.22" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          <line x1="5.64" y1="18.36" x2="4.22" y2="19.78" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        </motion.g>
      </motion.svg>
    </motion.button>
  );
}

export default AnimatedThemeToggler;
