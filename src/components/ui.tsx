'use client'

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { calendarDaysUntil } from '@/lib/day'

/* ==================================================================== *
 *  Bausteine und Bewegung
 *
 *  Regel für jede Animation hier: Sie darf nur bleiben, wenn ohne sie
 *  etwas an Klarheit fehlt.
 *
 *  Deshalb gibt es hier bewusst KEIN „alles fährt beim Erscheinen von
 *  unten ein". Dieses Muster war in der Vorfassung über jede Seite
 *  gelegt; es sagt nichts aus, ermüdet nach dem dritten Seitenwechsel
 *  und ist eines der zuverlässigsten Erkennungszeichen generierter
 *  Oberflächen. Was geblieben ist: hochzählende Zahlen (man sieht die
 *  Veränderung und ihre Richtung), sich füllende Balken, gleitende
 *  Marken zwischen Zuständen, das sich zeichnende Häkchen.
 * ==================================================================== */

/** Ruhiges Ausschwingen — die Hausbewegung dieser App. */
export const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------- Struktur ------------------------------- */

/**
 * Rubrik mit durchlaufender Linie. Das redaktionelle Grundmuster dieser
 * App: Abschnitte werden von einer Linie getrennt, nicht von einer
 * weiteren Karte umschlossen.
 */
export function SectionHead({
  title,
  hint,
  action,
  as: Tag = 'h2',
  className = '',
}: {
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={`mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 ${className}`}>
      <Tag className={Tag === 'h2' ? 'text-[17px]' : 'text-[15px]'}>{title}</Tag>
      {hint && <span className="text-[12.5px] text-faint">{hint}</span>}
      <span className="mx-1 hidden h-px min-w-6 flex-1 bg-rule sm:block" />
      {action}
    </div>
  )
}

export function Section({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title?: string
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      {(title || action) && <SectionHead title={title ?? ''} hint={hint} action={action} />}
      {children}
    </section>
  )
}

/**
 * Nur noch ein sanftes Auftauchen ohne Versatz — für Inhalte, die nach
 * dem Laden nachgereicht werden, damit sie nicht hart einspringen.
 * Der frühere gestaffelte `index` bleibt in der Signatur, wird aber
 * bewusst ignoriert.
 */
export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode
  index?: number
  className?: string
  y?: number
}) {
  const still = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: 'linear' }}
    >
      {children}
    </motion.div>
  )
}

/* -------------------------------- Zahlen -------------------------------- */

/**
 * Zählt weich auf den neuen Wert. Der Sinn: Nach einer Antwort ändern
 * sich Punkte und Prognose — die Bewegung macht sichtbar, DASS sich
 * etwas getan hat, und in welche Richtung.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  className = '',
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const still = useReducedMotion()
  const spring = useSpring(value, { stiffness: 90, damping: 20, mass: 0.7 })
  const text = useTransform(spring, (v) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  )

  useEffect(() => {
    spring.set(Number.isFinite(value) ? value : 0)
  }, [value, spring])

  if (still) {
    return (
      <span className={className}>
        {value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    )
  }
  return <motion.span className={className}>{text}</motion.span>
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  animate = true,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: ReactNode
  tone?: 'pos' | 'neg' | 'oxide' | 'accent'
  animate?: boolean
}) {
  const toneClass =
    tone === 'pos'
      ? 'text-pos'
      : tone === 'neg'
        ? 'text-neg'
        : tone === 'oxide'
          ? 'text-oxide'
          : tone === 'accent'
            ? 'text-accent'
            : 'text-ink'
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1.5 ${toneClass}`}>
        <span className="numeral text-[27px] leading-none">
          {typeof value === 'number' && animate ? <AnimatedNumber value={value} /> : value}
        </span>
        {unit && <span className="font-mono text-[11.5px] text-faint">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12.5px] leading-snug text-muted">{hint}</div>}
    </div>
  )
}

/* ------------------------------- Tastatur ------------------------------- */

/** Tastenhinweis. Die Übungsrunde ist vollständig mit der Tastatur bedienbar. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border border-rule bg-raised px-1 font-mono text-[10.5px] font-medium text-muted">
      {children}
    </kbd>
  )
}

/* -------------------------------- Auswahl -------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  name,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; title?: string }[]
  size?: 'sm' | 'md'
  /** eigener Name, damit die gleitende Marke nicht zwischen Gruppen springt */
  name?: string
}) {
  /* useId ist über Server- und Clientseite hinweg stabil — eine
     Zufallszahl wäre es nicht. */
  const auto = useId()
  const group = name ?? auto
  return (
    <div className="inline-flex rounded-md border border-rule bg-raised p-[3px]" role="tablist">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative rounded-[4px] font-medium transition-colors ${
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-[5px] text-[13px]'
            } ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId={group}
                className="absolute inset-0 rounded-[4px] border border-rule bg-surface"
                transition={{ duration: 0.2, ease: EASE }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- Zustände -------------------------------- */

/** Ehrlicher Leerzustand: sagt, warum hier nichts steht, und was hilft. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-ruleStrong px-5 py-12 text-center">
      <div className="text-[15.5px] font-medium">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-prose text-[13.5px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-60 ${className}`}
      aria-hidden
    />
  )
}

/** Ladezustand mit Struktur statt eines nackten Kreisels. */
export function Loading({ label = 'Wird geladen …', lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.1em] text-faint">
        <Spinner /> {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="shimmer h-11 rounded-md" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- Dialog --------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="relative w-full max-w-lg rounded-t-xl border border-rule bg-surface shadow-float outline-none sm:rounded-xl"
          >
            <div className="border-b border-rule px-5 py-3.5">
              <h2 className="text-[16px]">{title}</h2>
            </div>
            <div className="max-h-[62vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ----------------------------- Aufklappbereich ----------------------------- */

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  tone = 'default',
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  tone?: 'default' | 'quiet'
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={tone === 'quiet' ? '' : 'panel overflow-hidden'}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium transition-colors hover:bg-raised"
      >
        <motion.svg
          className="h-3 w-3 shrink-0 text-faint"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        {summary}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-rule px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------- Countdown -------------------------------- */

export function useCountdown(iso: string) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; past: boolean } | null>(null)
  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now()
      const abs = Math.abs(ms)
      setLeft({
        /* Kalendertage — dieselbe Zahl wie im Lernplan. */
        d: Math.abs(calendarDaysUntil(iso)),
        h: Math.floor((abs % 86_400_000) / 3_600_000),
        m: Math.floor((abs % 3_600_000) / 60_000),
        past: ms < 0,
      })
    }
    tick()
    const i = setInterval(tick, 30_000)
    return () => clearInterval(i)
  }, [iso])
  return left
}
