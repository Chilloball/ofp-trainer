import type { Config } from 'tailwindcss'

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: rgb('paper'),
        surface: rgb('surface'),
        sunken: rgb('sunken'),
        line: rgb('line'),
        lineStrong: rgb('line-strong'),
        ink: rgb('ink'),
        muted: rgb('muted'),
        faint: rgb('faint'),
        accent: rgb('accent'),
        accentInk: rgb('accent-ink'),
        accentWash: rgb('accent-wash'),
        ok: rgb('ok'),
        okWash: rgb('ok-wash'),
        warn: rgb('warn'),
        warnWash: rgb('warn-wash'),
        bad: rgb('bad'),
        badWash: rgb('bad-wash'),
        py: rgb('py'),
        java: rgb('java'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      /* Feinere Abstufungen als die Voreinstellung — Flächen sollen sich
         nur andeuten, nicht aufdrängen. */
      opacity: {
        6: '0.06',
        8: '0.08',
        12: '0.12',
        15: '0.15',
        18: '0.18',
        22: '0.22',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },
      borderRadius: {
        DEFAULT: '5px',
        md: '7px',
        lg: '10px',
        xl: '13px',
      },
      maxWidth: {
        prose: '68ch',
        content: '1120px',
      },
      boxShadow: {
        pop: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 28px -12px rgb(0 0 0 / 0.22)',
      },
    },
  },
  plugins: [],
}

export default config
