/**
 * Tagesschlüssel in **lokaler** Zeit.
 *
 * `toISOString()` rechnet nach UTC um. In Deutschland (UTC+1/+2) hätte
 * damit alles, was zwischen Mitternacht und ein bzw. zwei Uhr passiert,
 * auf dem Vortag gelandet — genau die Zeit, in der viele lernen. Das
 * hätte Tagesziel, Serie und Kalender verschoben.
 */
export function dayKey(date: Date | number = Date.now()): string {
  const d = typeof date === 'number' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Tagesschlüssel von gestern, ebenfalls lokal. */
export function previousDayKey(date: Date | number = Date.now()): string {
  const d = typeof date === 'number' ? new Date(date) : new Date(date.getTime())
  d.setDate(d.getDate() - 1)
  return dayKey(d)
}

/** Datum aus einem Tagesschlüssel — auf 12 Uhr gesetzt, damit keine Zeitzone stört. */
export function dayFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/** Die letzten `n` Tage bis heute, lokal gerechnet. */
export function lastDayKeys(n: number, from: Date | number = Date.now()): string[] {
  const base = typeof from === 'number' ? new Date(from) : new Date(from.getTime())
  base.setHours(12, 0, 0, 0)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getTime())
    d.setDate(d.getDate() - i)
    out.push(dayKey(d))
  }
  return out
}

/**
 * Verbleibende KALENDERTAGE bis zu einem Termin.
 *
 * Bewusst nicht `(ziel - jetzt) / 86400000`: Am 11. um 23 Uhr wären das
 * bis zum 31. „19,4 Tage" und damit je nach Rundung 19 oder 20 — die
 * Oberfläche zeigte dann an zwei Stellen verschiedene Zahlen. Ein
 * Lernender zählt Tage im Kalender ab, nicht in Stunden.
 */
export function calendarDaysUntil(iso: string, from: Date | number = Date.now()): number {
  const a = typeof from === 'number' ? new Date(from) : new Date(from.getTime())
  const b = new Date(iso)
  a.setHours(12, 0, 0, 0)
  b.setHours(12, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
