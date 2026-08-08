/* ==================================================================== *
 *  OFP-Logo
 *
 *  Die Marke bringt beide Hälften des Fachs zusammen:
 *  die geschweiften Klammern der objektorientierten Welt und das
 *  Lambda der funktionalen Programmierung.  { λ }
 * ==================================================================== */

export function LogoMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="OFP"
    >
      <rect width="32" height="32" rx="7.5" fill="rgb(var(--ink))" />
      <g
        stroke="rgb(var(--paper))"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* geschweifte Klammern — Objektorientierung */}
        <path d="M11.6 7.4c-2.1 0-2.2 1.6-2.2 3.4 0 2.5-1.6 5.2-1.6 5.2s1.6 2.7 1.6 5.2c0 1.8.1 3.4 2.2 3.4" />
        <path d="M20.4 7.4c2.1 0 2.2 1.6 2.2 3.4 0 2.5 1.6 5.2 1.6 5.2s-1.6 2.7-1.6 5.2c0 1.8-.1 3.4-2.2 3.4" />
        {/* Lambda — funktionale Programmierung */}
        <path d="M13.15 10.1 18.9 21.9" />
        <path d="M16.35 16.55 13.6 21.9" />
      </g>
    </svg>
  )
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 26 : 30} />
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight">OFP&#8202;Trainer</span>
        {!compact && (
          <span className="mt-[3px] block text-[10.5px] font-medium uppercase tracking-[0.11em] text-faint">
            Universität Siegen
          </span>
        )}
      </span>
    </span>
  )
}
