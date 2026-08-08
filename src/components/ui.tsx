'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ==================================================================== *
 *  Kleine, wiederverwendbare Bausteine
 * ==================================================================== */

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
        <div className="mb-3 flex items-baseline gap-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {hint && <span className="text-[13px] text-faint">{hint}</span>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Meter({
  value,
  tone = 'accent',
  className = '',
}: {
  /** 0..1 */
  value: number
  tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'py' | 'java'
  className?: string
}) {
  const color = {
    accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', py: 'bg-py', java: 'bg-java',
  }[tone]
  return (
    <div className={`meter ${className}`}>
      <span className={color} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  tone?: 'ok' | 'warn' | 'bad'
}) {
  const toneClass = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${toneClass}`}>
        <span className="tabnum text-[26px] font-semibold leading-none">{value}</span>
        {unit && <span className="text-[13px] font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[12.5px] text-muted">{hint}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; title?: string }[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-md border border-line bg-sunken p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`rounded-[5px] font-medium transition-colors ${
            size === 'sm' ? 'px-2 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]'
          } ${value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel px-5 py-8 text-center">
      <div className="text-[15px] font-medium">{title}</div>
      {children && <div className="mx-auto mt-1.5 max-w-prose text-[13.5px] text-muted">{children}</div>}
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

export function Loading({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 py-10 text-[13.5px] text-muted">
      <Spinner /> {label}
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

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="enter relative w-full max-w-lg rounded-t-xl border border-line bg-surface shadow-pop outline-none sm:rounded-xl"
      >
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
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
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-sunken"
      >
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </button>
      {open && <div className="enter border-t border-line px-4 py-3.5">{children}</div>}
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
