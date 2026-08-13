import type { SourceRef } from '@/lib/types'
import { hasPdf, pdfUrl } from '@/lib/material'

/* ==================================================================== *
 *  Quellenverweise
 *
 *  Ein Verweis wie „OFP_Java.pdf, S. 361" soll keine Fußnote sein,
 *  sondern ein Klick: Das PDF öffnet in einem neuen Tab auf genau
 *  dieser Seite. Fehlt die Datei im Bündel (z. B. Java-Beispieldateien),
 *  bleibt der Verweis als Text stehen.
 * ==================================================================== */

export function SourceLink({ source }: { source: SourceRef }) {
  const label = (
    <>
      {source.file.replace(/\.pdf$/, '')}
      {source.page ? <span className="text-faint"> · S. {source.page}</span> : null}
    </>
  )
  if (!hasPdf(source.file)) {
    return (
      <span className="font-mono text-[11.5px] text-muted" title={source.label}>
        {label}
      </span>
    )
  }
  return (
    <a
      href={pdfUrl(source.file, source.page)}
      target="_blank"
      rel="noreferrer"
      title={source.label ? `${source.label} — öffnet das PDF auf Seite ${source.page ?? 1}` : 'PDF öffnen'}
      className="group inline-flex items-center gap-1.5 font-mono text-[11.5px] text-accent decoration-accent/30 underline-offset-2 hover:underline"
    >
      <svg className="h-3 w-3 shrink-0 opacity-70" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M7 2h3v3M10 2 5.5 6.5M8.5 7.5V9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </a>
  )
}

export function SourceList({ sources, className = '' }: { sources: SourceRef[]; className?: string }) {
  if (!sources.length) return null
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-1.5 ${className}`}>
      {sources.map((s, i) => (
        <li key={i}>
          <SourceLink source={s} />
        </li>
      ))}
    </ul>
  )
}
