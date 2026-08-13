import { Archivo, IBM_Plex_Mono } from 'next/font/google'

/* ==================================================================== *
 *  Schriften — „eine Familie, viele Stimmen"
 *
 *  Die vorherige Fassung setzte auf eine Antiqua (Fraunces) über warmem
 *  Cremeweiß. Genau diese Kombination ist inzwischen die Signatur der
 *  KI-Werkzeuge selbst — sie nimmt einem Projekt das Gesicht, statt ihm
 *  eines zu geben. Also der Gegenentwurf:
 *
 *    Archivo        — eine Grotesk mit echter BREITENACHSE (wdth 62–125).
 *                     Das ist der Trick des ganzen Systems: Überschriften
 *                     laufen breit (wdth 112–122) und wirken dadurch
 *                     plakatartig gesetzt; Fließtext läuft normal und
 *                     liest sich ruhig. Eine Familie, aber zwei klar
 *                     unterscheidbare Stimmen — das ist das Kennzeichen
 *                     eines gebauten Systems statt zweier zufällig
 *                     kombinierter Google-Fonts.
 *
 *    IBM Plex Mono  — Quelltext, Zahlen, Kennzeichnungen. Übernimmt hier
 *                     bewusst auch Aufgaben außerhalb von Code: Punkte,
 *                     Daten, Themenkürzel. Das gibt der Oberfläche einen
 *                     technischen Grundton, der zum Fach passt, und ist
 *                     nicht die übliche Editor-Schrift.
 *
 *  next/font lädt beides beim Bauen herunter und liefert es selbst aus —
 *  keine Anfrage an Google zur Laufzeit, kein Umspringen der Schrift.
 * ==================================================================== */

export const sans = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  axes: ['wdth'],
})

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})

export const fontClass = `${sans.variable} ${mono.variable}`
