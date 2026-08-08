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
        brass: rgb('brass'),
        brassWash: rgb('brass-wash'),
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
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /* Feinere Abstufungen als die Voreinstellung — Flächen sollen sich
         andeuten, nicht aufdrängen. */
      opacity: {
        4: '0.04',
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
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '13px',
        '2xl': '18px',
      },
      maxWidth: {
        prose: '68ch',
        content: '1140px',
      },
      boxShadow: {
        pop: '0 2px 6px rgb(var(--shadow-color) / 0.08), 0 20px 48px -20px rgb(var(--shadow-color) / 0.35)',
        inset: 'inset 0 1px 0 rgb(255 255 255 / 0.12)',
      },
      transitionTimingFunction: {
        // ruhiges Ausschwingen, kein Federn
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

export default config
