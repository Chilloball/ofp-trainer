/**
 * Basispfad der Auslieferung.
 *
 * Auf GitHub Pages liegt die App unter `/<repo>/`, lokal und auf einer
 * eigenen Domain unter `/`. `next/link` berücksichtigt den Pfad selbst;
 * alles, was direkt geladen wird (Content, Worker, Icons), geht über
 * diese Konstante.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}
