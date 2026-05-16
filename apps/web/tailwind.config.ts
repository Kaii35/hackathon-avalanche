import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        canvas: 'hsl(var(--bg-canvas) / <alpha-value>)',
        surface: 'hsl(var(--bg-surface) / <alpha-value>)',
        elevated: 'hsl(var(--bg-elevated) / <alpha-value>)',
        overlay: 'hsl(var(--bg-overlay) / <alpha-value>)',
        border: {
          subtle: 'hsl(var(--border-subtle) / <alpha-value>)',
          DEFAULT: 'hsl(var(--border-default) / <alpha-value>)',
          strong: 'hsl(var(--border-strong) / <alpha-value>)',
        },
        foreground: {
          DEFAULT: 'hsl(var(--text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          tertiary: 'hsl(var(--text-tertiary) / <alpha-value>)',
          disabled: 'hsl(var(--text-disabled) / <alpha-value>)',
        },
        // Arkangeles brand · electric blue
        brand: {
          DEFAULT: '#2A5BFF',
          50: '#EEF2FF',
          100: '#D9E2FF',
          200: '#B3C5FF',
          300: '#8DA8FF',
          400: '#5C82FF',
          500: '#2A5BFF',
          600: '#1E45CC',
          700: '#163399',
          800: '#0F2266',
          900: '#081133',
          glow: 'rgba(42, 91, 255, 0.35)',
        },
        success: {
          DEFAULT: '#10B981',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          fg: '#10B981',
        },
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          fg: '#D97706',
        },
        danger: {
          DEFAULT: '#EF4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.3)',
          fg: '#DC2626',
        },
        info: {
          DEFAULT: '#3B82F6',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.3)',
          fg: '#2563EB',
        },
        accent: {
          violet: '#8B5CF6',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xs: '0.25rem',
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(15, 23, 42, 0.06)',
        DEFAULT: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        md: '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.08)',
        lg: '0 10px 15px -3px rgba(15, 23, 42, 0.12), 0 4px 6px -4px rgba(15, 23, 42, 0.08)',
        xl: '0 20px 25px -5px rgba(15, 23, 42, 0.14), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
        'glow-brand': '0 0 0 1px rgba(42, 91, 255, 0.35), 0 8px 32px -4px rgba(42, 91, 255, 0.45)',
        'glow-soft': '0 0 80px -20px rgba(42, 91, 255, 0.4)',
        'inset-border': 'inset 0 0 0 1px hsl(var(--border-default))',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'flash-up': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-down': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.21, 1.02, 0.73, 1)',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'flash-up': 'flash-up 0.6s ease-out',
        'flash-down': 'flash-down 0.6s ease-out',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, hsl(var(--border-subtle) / 0.4) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border-subtle) / 0.4) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #2A5BFF 0%, #163399 100%)',
        'gradient-mesh':
          'radial-gradient(at 20% 20%, rgba(42, 91, 255, 0.18) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.10) 0px, transparent 50%), radial-gradient(at 0% 80%, rgba(6, 182, 212, 0.08) 0px, transparent 50%)',
      },
    },
  },
  plugins: [animate],
};

export default config;
