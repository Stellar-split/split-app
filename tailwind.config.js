/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#0f172a',
          50:  '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1':      ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h2':      ['1.5rem',  { lineHeight: '1.3', letterSpacing: '-0.01em',  fontWeight: '600' }],
        'h3':      ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body':    ['1rem',    { lineHeight: '1.6' }],
        'small':   ['0.875rem', { lineHeight: '1.5' }],
        'xs':      ['0.75rem',  { lineHeight: '1.4' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
      },
      borderRadius: {
        'sm':  '0.375rem',
        DEFAULT: '0.5rem',
        'md':  '0.625rem',
        'lg':  '0.75rem',
        'xl':  '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(99,102,241,0.25)',
        'glow':    '0 0 24px rgba(99,102,241,0.35)',
        'glow-lg': '0 0 40px rgba(99,102,241,0.45)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'gradient-hero':  'radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.18) 0%, transparent 65%)',
      },
    },
  },
  plugins: [],
};