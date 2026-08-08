import { Fraunces, Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google'

/* ==================================================================== *
 *  Schriften
 *
 *  Bewusst abseits der üblichen Verdächtigen (Inter, Geist, Space Grotesk),
 *  weil die einem Projekt sofort das Gesicht nehmen.
 *
 *    Fraunces          — Überschriften und große Zahlen. Eine variable
 *                        Antiqua mit optischer Achse: wirkt gedruckt,
 *                        akademisch, und gibt der App einen Charakter,
 *                        den keine Grotesk liefert.
 *    Schibsted Grotesk — Bedienoberfläche und Fließtext. Redaktionelle
 *                        Grotesk mit eigenwilligem a und g, sehr gut
 *                        lesbar in kleinen Graden.
 *    JetBrains Mono    — Quelltext. Für Code zählt Lesbarkeit vor
 *                        Eigenwilligkeit: klare Klammern, unterscheidbares
 *                        0/O und l/1/I.
 *
 *  next/font lädt sie beim Bauen herunter und liefert sie selbst aus —
 *  keine Anfrage an Google zur Laufzeit, kein Ruckeln beim Schriftwechsel.
 * ==================================================================== */

export const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'WONK', 'opsz'],
})

export const sans = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

export const fontClass = `${display.variable} ${sans.variable} ${mono.variable}`
