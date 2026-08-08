'use client'

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ==================================================================== *
 *  Bausteine und Bewegung
 *
 *  Grundregel: Eine Animation darf nur bleiben, wenn ohne sie etwas an
 *  Klarheit fehlt. Zahlen zählen hoch, damit man die Veränderung sieht.
 *  Listen laufen gestaffelt ein, damit man die Reihenfolge erfasst.
 *  Alles andere ist still.
 * ==================================================================== */

/** Ruhiges Ausschwingen — die Hausbewegung dieser App. */
export const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------ Struktur ------------------------------ */

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
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {title && <h2 className="text-[17px]">{title}</h2>}
          {hint && <span className="text-[13px] text-faint">{hint}</span>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Läuft beim ersten Erscheinen kurz ein; in Listen gestaffelt über `index`. */
export function Reveal({
  children,
  index = 0,
  className = '',
  y = 8,
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
      initial={still ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.035 }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------- Zahlen ------------------------------- */

/**
 * Zählt weich auf den neuen Wert. Sinn dahinter: Nach einer Antwort
 * verändern sich Punkte und Prognose — die Bewegung macht sichtbar,
 * dass sich etwas getan hat, und in welche Richtung.
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
    spring.set(value)
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
  tone?: 'ok' | 'warn' | 'bad' | 'brass'
  animate?: boolean
}) {
  const toneClass =
    tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : tone === 'brass' ? 'text-brass' : 'text-ink'
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 flex items-baseline gap-1.5 ${toneClass}`}>
        <span className="numeral text-[28px] leading-none">
          {typeof value === 'number' && animate ? <AnimatedNumber value={value} /> : value}
        </span>
        {unit && <span className="text-[13px] font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12.5px] text-muted">{hint}</div>}
    </div>
  )
}

/* ------------------------------ Auswahl ------------------------------ */

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
  /** eigener Name, damit der gleitende Marker nicht zwischen Gruppen springt */
  name?: string
}) {
  const id = useRef(name ?? `seg-${Math.random().toString(36).slice(2)}`)
  return (
    <div className="inline-flex rounded-lg border border-line bg-sunken p-0.5" role="tablist">
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative rounded-[7px] font-medium transition-colors ${
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]'
            } ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {on && (
              <motion.span
                layoutId={id.current}
                className="absolute inset-0 rounded-[7px] border border-line bg-surface shadow-[0_1px_2px_rgb(var(--shadow-color)/0.12)]"
                transition={{ duration: 0.22, ease: EASE }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------ Zustände ------------------------------ */

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel px-5 py-10 text-center">
      <div className="text-[16px] font-medium">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-prose text-[13.5px] text-muted">{children}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60 ${className}`}
      aria-hidden
    />
  )
}

/** Ladezustand mit Struktur statt eines nackten Kreisels. */
export function Loading({ label = 'Wird geladen …', lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 text-[13.5px] text-muted">
        <Spinner /> {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="shimmer h-11 rounded-lg" style={{ opacity: 1 - i * 0.22 }} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------- Dialog ------------------------------- */

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
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="relative w-full max-w-lg rounded-t-2xl border border-line bg-surface shadow-pop outline-none sm:rounded-2xl"
          >
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[17px]">{title}</h2>
            </div>
            <div className="max-h-[62vh] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ---------------------------- Aufklappbereich ---------------------------- */

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
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px] font-medium transition-colors hover:bg-sunken"
      >
        <motion.svg
          className="h-3.5 w-3.5 shrink-0 text-faint"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
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
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------ Countdown ------------------------------ */

export function useCountdown(iso: string) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; past: boolean } | null>(null)
  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now()
      const abs = Math.abs(ms)
      setLeft({
        d: Math.floor(abs / 86_400_000),
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
