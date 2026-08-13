import type { Config } from 'tailwindcss'

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

/* ==================================================================== *
 *  Tailwind ist hier nur der Zugriff auf die Marken-Token aus
 *  globals.css. Es gibt bewusst KEINE Tailwind-Standardfarben im
 *  Einsatz (slate, indigo, violet) — jede Farbe in dieser App hat eine
 *  Bedeutung und einen Namen.
 * ==================================================================== */

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: rgb('canvas'),
        surface: rgb('surface'),
        raised: rgb('raised'),
        sink: rgb('sink'),
        rule: rgb('rule'),
        ruleStrong: rgb('rule-strong'),
        ink: rgb('ink'),
        muted: rgb('muted'),
        faint: rgb('faint'),
        accent: rgb('accent'),
        accentInk: rgb('accent-ink'),
        accentSoft: rgb('accent-soft'),
        oxide: rgb('oxide'),
        oxideSoft: rgb('oxide-soft'),
        pos: rgb('pos'),
        posSoft: rgb('pos-soft'),
        neg: rgb('neg'),
        negSoft: rgb('neg-soft'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /* Feinere Abstufungen als die Voreinstellung — getönte Flächen
         sollen sich andeuten, nicht aufdrängen. */
      opacity: {
        3: '0.03',
        4: '0.04',
        6: '0.06',
        8: '0.08',
        12: '0.12',
        14: '0.14',
        18: '0.18',
        22: '0.22',
        28: '0.28',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },
      /* Klein und konsequent. „rounded-2xl auf allem" ist eines der
         sichersten Erkennungszeichen generierter Oberflächen. */
      borderRadius: {
        DEFAULT: '4px',
        sm: '3px',
        md: '6px',
        lg: '8px',
        xl: '11px',
        '2xl': '14px',
      },
      maxWidth: {
        prose: '70ch',
        content: '1160px',
        wide: '1420px',
      },
      boxShadow: {
        /* Schatten nur für Dinge, die wirklich über der Seite schweben:
           Dialoge, Menüs, Meldungen. Flächen im Fluss tragen Haarlinien. */
        float: '0 1px 2px rgb(var(--shadow) / 0.10), 0 24px 60px -24px rgb(var(--shadow) / 0.42)',
        lift: '0 1px 2px rgb(var(--shadow) / 0.08), 0 10px 24px -14px rgb(var(--shadow) / 0.30)',
      },
      transitionTimingFunction: {
        /* Ruhiges Ausschwingen; kein Federn, kein Überschwingen. */
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      spacing: {
        rail: '246px',
      },
    },
  },
  plugins: [],
}

export default config
