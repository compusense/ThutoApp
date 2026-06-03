import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /* ── Fonts ─────────────────────────────────────────── */
      fontFamily: {
        body:     ['Outfit', 'PT Sans', 'sans-serif'],
        headline: ['Cormorant Garamond', 'Space Grotesk', 'serif'],
        sans:     ['Outfit', 'PT Sans', 'sans-serif'],
        serif:    ['Cormorant Garamond', 'Georgia', 'serif'],
        code:     ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      /* ── Colors — all wired to CSS variables ───────────── */
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT:    'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT:    'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },

        /* Brand tokens */
        gold:        'hsl(var(--gold))',
        terracotta:  'hsl(var(--terracotta))',
        sand:        'hsl(var(--sand))',
        midnight:    'hsl(var(--midnight))',

        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',

        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },

        sidebar: {
          DEFAULT:              'hsl(var(--sidebar-background))',
          foreground:           'hsl(var(--sidebar-foreground))',
          primary:              'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent:               'hsl(var(--sidebar-accent))',
          'accent-foreground':  'hsl(var(--sidebar-accent-foreground))',
          border:               'hsl(var(--sidebar-border))',
          ring:                 'hsl(var(--sidebar-ring))',
        },
      },

      /* ── Border radius ──────────────────────────────────── */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /* ── Typography scale ───────────────────────────────── */
      fontSize: {
        '2xs': ['0.65rem',  { lineHeight: '1rem' }],
        xs:    ['0.75rem',  { lineHeight: '1.125rem' }],
        sm:    ['0.875rem', { lineHeight: '1.375rem' }],
        base:  ['1rem',     { lineHeight: '1.6rem' }],
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],
        xl:    ['1.25rem',  { lineHeight: '1.875rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl': ['3rem',     { lineHeight: '1.1' }],
        '6xl': ['3.75rem',  { lineHeight: '1.05' }],
        '7xl': ['4.5rem',   { lineHeight: '1' }],
      },

      /* ── Keyframes ──────────────────────────────────────── */
      keyframes: {
        /* Radix accordion */
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },

        /* Entrance animations */
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },

        /* Looping */
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--gold) / 0.45)' },
          '50%':       { boxShadow: '0 0 0 8px hsl(var(--gold) / 0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '0%':   { transform: 'translateX(-100%) skewX(-15deg)' },
          '100%': { transform: 'translateX(350%)  skewX(-15deg)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)',   opacity: '1' },
          '50%':       { transform: 'scale(1.4)', opacity: '0.6' },
        },
      },

      /* ── Animation shorthands ───────────────────────────── */
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'fade-in':         'fade-in 0.4s ease both',
        'fade-in-up':      'fade-in-up 0.5s ease both',
        'fade-in-down':    'fade-in-down 0.5s ease both',
        'slide-in-right':  'slide-in-right 0.4s ease both',
        'slide-in-left':   'slide-in-left 0.4s ease both',
        'scale-in':        'scale-in 0.35s ease both',
        'pulse-gold':      'pulse-gold 2s ease-in-out infinite',
        'float':           'float 4s ease-in-out infinite',
        'shimmer':         'shimmer 1.8s ease infinite',
        'spin-slow':       'spin-slow 8s linear infinite',
        'breathe':         'breathe 2.4s ease-in-out infinite',
      },

      /* ── Box shadows ────────────────────────────────────── */
      boxShadow: {
        'gold-sm': '0 2px 12px hsl(var(--gold) / 0.2)',
        'gold-md': '0 4px 24px hsl(var(--gold) / 0.25)',
        'gold-lg': '0 8px 40px hsl(var(--gold) / 0.3)',
        'card':    '0 1px 3px hsl(var(--foreground) / 0.06), 0 4px 16px hsl(var(--foreground) / 0.04)',
        'card-hover': '0 4px 20px hsl(var(--foreground) / 0.1), 0 1px 4px hsl(var(--foreground) / 0.06)',
        'primary-glow': '0 4px 24px hsl(var(--primary) / 0.3)',
      },

      /* ── Backdrop blur ──────────────────────────────────── */
      backdropBlur: {
        xs: '2px',
      },

      /* ── Transitions ────────────────────────────────────── */
      transitionTimingFunction: {
        'spring':    'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out':'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
