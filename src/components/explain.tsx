'use client'

import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { retrievability } from '@/lib/srs'

/* ==================================================================== *
 *  ERKLÄRENDE GRAFIKEN
 *
 *  Regel für alles hier: Die Grafik ersetzt den Absatz, sie begleitet
 *  ihn nicht. Wer daneben noch fünf Zeilen Text braucht, hat die Grafik
 *  nicht fertig gebaut.
 *
 *  Alle Kurven rechnen mit denselben Formeln wie der Lernalgorithmus
 *  (`srs.ts`) — es sind keine gemalten Beispielkurven, sondern die
 *  tatsächliche Vergessenskurve dieser App.
 * ==================================================================== */

const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------- Vergessenskurve ------------------------- */

/**
 * Zeigt, was Wiederholung bewirkt: Ohne sie fällt die Abrufwahrschein-
 * lichkeit steil ab. Jede Wiederholung setzt sie zurück — und die Kurve
 * fällt danach flacher, das Wissen hält länger.
 *
 * Das ist der eine Zusammenhang, den man verstanden haben muss, um zu
 * akzeptieren, dass jeden Tag ein Wiederholungsblock ansteht.
 */
export function ForgettingCurve({
  days = 30,
  height = 150,
  showReviews = true,
  className = '',
}: {
  days?: number
  height?: number
  showReviews?: boolean
  className?: string
}) {
  const still = useReducedMotion()
  const W = 340
  const H = height
  const padL = 30
  const padB = 22
  const padT = 10
  const plotW = W - padL - 8
  const plotH = H - padB - padT

  const x = (d: number) => padL + (d / days) * plotW
  const y = (r: number) => padT + (1 - r) * plotH

  /* Startstabilität nach EINEM erfolgreichen Abruf — der Wert stammt
     aus dem FSRS-Parametersatz in `srs.ts` (initS bei „schwer").
     Damit liegt die Kurve nach 14 Tagen bei 52 %, und die Aussage
     „nach zwei Wochen ist die Hälfte weg" ist wörtlich richtig statt
     ungefähr. */
  const S0 = 1.2

  const decay = useMemo(() => {
    const pts: string[] = []
    for (let d = 0; d <= days; d += 0.5) {
      pts.push(`${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(retrievability(d, S0)).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Mit Wiederholung: bei jedem Termin springt die Kurve auf 1 und die
     Stabilität wächst — die Zacken werden immer breiter. */
  const { path, marks } = useMemo(() => {
    const pts: string[] = []
    const marks: { d: number }[] = []
    let stability = S0
    let t = 0
    let first = true
    while (t < days) {
      /* Wiederholung, sobald die Abrufwahrscheinlichkeit auf 90 % fällt */
      const span = Math.min(stability * 1.0, days - t)
      for (let d = 0; d <= span; d += 0.5) {
        pts.push(`${first ? 'M' : 'L'}${x(t + d).toFixed(1)},${y(retrievability(d, stability)).toFixed(1)}`)
        first = false
      }
      t += span
      if (t < days) {
        marks.push({ d: t })
        pts.push(`L${x(t).toFixed(1)},${y(1).toFixed(1)}`)
        stability *= 2.4
      }
    }
    return { path: pts.join(' '), marks }
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vergessenskurve mit und ohne Wiederholung">
        {/* Hilfslinien */}
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line x1={padL} y1={y(r)} x2={W - 8} y2={y(r)} stroke="rgb(var(--rule))" strokeWidth="1" />
            <text x={padL - 6} y={y(r) + 3.5} textAnchor="end" className="fill-[rgb(var(--faint))] font-mono text-[8px]">
              {Math.round(r * 100)}
            </text>
          </g>
        ))}
        <text x={padL} y={H - 6} className="fill-[rgb(var(--faint))] font-mono text-[8px]">
          heute
        </text>
        <text
          x={9}
          y={padT + plotH / 2}
          transform={`rotate(-90 9 ${padT + plotH / 2})`}
          textAnchor="middle"
          className="fill-[rgb(var(--faint))] font-mono text-[7.5px] uppercase tracking-[0.1em]"
        >
          % abrufbar
        </text>
        <text x={W - 8} y={H - 6} textAnchor="end" className="fill-[rgb(var(--faint))] font-mono text-[8px]">
          in {days} Tagen
        </text>

        {/* Ohne Wiederholung */}
        <motion.path
          d={decay}
          fill="none"
          stroke="rgb(var(--neg))"
          strokeWidth="2"
          strokeDasharray="3 3"
          initial={still ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        />

        {/* Mit Wiederholung */}
        {showReviews && (
          <>
            <motion.path
              d={path}
              fill="none"
              stroke="rgb(var(--accent))"
              strokeWidth="2.2"
              strokeLinejoin="round"
              initial={still ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
            />
            {marks.map((m, i) => (
              <motion.circle
                key={i}
                cx={x(m.d)}
                cy={y(1)}
                r="3"
                fill="rgb(var(--accent))"
                initial={still ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: EASE, delay: 0.6 + i * 0.25 }}
              />
            ))}
          </>
        )}
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.06em]">
        <span className="flex items-center gap-1.5 text-neg">
          <svg width="18" height="4" aria-hidden>
            <line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
          einmal gelernt
        </span>
        {showReviews && (
          <span className="flex items-center gap-1.5 text-accent">
            <svg width="18" height="4" aria-hidden>
              <line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2" />
            </svg>
            mit Wiederholung
          </span>
        )}
      </figcaption>
    </figure>
  )
}

/* --------------------------- Die Lernschleife --------------------------- */

const LOOP = [
  { label: 'Verstehen', hint: 'gelöstes Beispiel' },
  { label: 'Abrufen', hint: 'ohne Hilfe lösen' },
  { label: 'Fehler klären', hint: 'sofort, nicht später' },
  { label: 'Wiederkommen', hint: 'kurz bevor du es vergisst' },
]

/**
 * Die vier Schritte, aus denen jede Runde besteht — als Kreis, weil
 * genau das der Punkt ist: Es hört nicht nach dem Lösen auf.
 */
export function LearnLoop({ active = -1, className = '' }: { active?: number; className?: string }) {
  const still = useReducedMotion()

  return (
    <ol className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className}`}>
      {LOOP.map((s, i) => {
        const on = active < 0 || i <= active
        return (
          <motion.li
            key={s.label}
            className={`relative rounded-md border px-3 py-3 transition-colors ${
              on ? 'border-accent/40 bg-accent/6' : 'border-rule bg-surface'
            }`}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: i * 0.12 }}
          >
            <span className={`font-mono text-[10px] tabular-nums ${on ? 'text-accent' : 'text-faint'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="mt-1 block text-[13.5px] font-medium leading-tight">{s.label}</span>
            <span className="mt-0.5 block text-[11.5px] leading-tight text-muted">{s.hint}</span>

            {/* Pfeil zum nächsten Schritt */}
            {i < LOOP.length - 1 && (
              <span
                className="absolute -right-[7px] top-1/2 hidden -translate-y-1/2 text-faint sm:block"
                aria-hidden
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 5h6M5.5 2.5 8 5l-2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </motion.li>
        )
      })}
    </ol>
  )
}

/* ------------------- Verschränken statt Blocklernen ------------------- */

const BLOCK_ROW = ['a', 'a', 'a', 'a', 'b', 'b', 'b', 'b', 'c', 'c', 'c', 'c']
const MIX_ROW = ['a', 'c', 'b', 'a', 'b', 'c', 'c', 'a', 'b', 'b', 'c', 'a']
const TONE: Record<string, string> = { a: 'bg-accent', b: 'bg-oxide', c: 'bg-pos' }

/**
 * Warum die Runden gemischt sind: Blocklernen fühlt sich beim Üben
 * besser an, verschränktes Üben sitzt hinterher besser. Die beiden
 * Reihen zeigen den Unterschied, ohne dass man ihn lesen muss.
 */
export function InterleaveVsBlock({ className = '' }: { className?: string }) {
  const still = useReducedMotion()

  const Row = ({ cells, delay }: { cells: string[]; delay: number }) => (
    <div className="flex gap-[3px]">
      {cells.map((c, i) => (
        <motion.span
          key={i}
          className={`h-6 flex-1 rounded-[2px] ${TONE[c]}`}
          initial={still ? false : { opacity: 0, scaleY: 0.3 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.28, ease: EASE, delay: delay + i * 0.025 }}
        />
      ))}
    </div>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="eyebrow">Ein Thema am Stück</span>
          <span className="font-mono text-[10.5px] text-faint">fühlt sich leicht an</span>
        </div>
        <Row cells={BLOCK_ROW} delay={0} />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="eyebrow text-accent">Themen gemischt</span>
          <span className="font-mono text-[10.5px] text-accent">sitzt in der Klausur</span>
        </div>
        <Row cells={MIX_ROW} delay={0.4} />
      </div>
    </div>
  )
}

/* --------------------------- Lektionsraster --------------------------- */

export interface LessonDot {
  id: string
  title: string
  status: 'offen' | 'laufend' | 'sitzt' | 'auffrischen'
  lang: 'python' | 'java'
}

/**
 * Zwanzig Lektionen als zwanzig Felder. Beantwortet ohne eine Zahl die
 * Frage „wie weit bin ich?" — und zeigt gleichzeitig, wo die Lücken
 * liegen.
 */
export function LessonGrid({
  lessons,
  className = '',
  onSelect,
}: {
  lessons: LessonDot[]
  className?: string
  onSelect?: (id: string) => void
}) {
  const still = useReducedMotion()
  const fill: Record<LessonDot['status'], string> = {
    offen: 'bg-canvas border-ruleStrong',
    laufend: 'bg-accent/40 border-accent',
    sitzt: 'bg-pos border-pos',
    auffrischen: 'bg-oxide/50 border-oxide',
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {lessons.map((l, i) => {
        const Tag = onSelect ? 'button' : 'span'
        return (
          <motion.span
            key={l.id}
            initial={still ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.26, ease: EASE, delay: Math.min(i * 0.022, 0.5) }}
          >
            <Tag
              onClick={onSelect ? () => onSelect(l.id) : undefined}
              title={`${l.title} — ${l.status}`}
              className={`block h-5 w-5 rounded-[3px] border ${fill[l.status]} ${
                onSelect ? 'cursor-pointer transition-transform hover:scale-125' : ''
              }`}
            />
          </motion.span>
        )
      })}
    </div>
  )
}

/* ------------------------------- Tagesband ------------------------------- */

/**
 * Der heutige Plan als ein Band: Jeder Block so breit, wie er dauert.
 * Man sieht auf einen Blick, worauf die Zeit heute geht.
 */
export function DayRibbon({
  blocks,
  className = '',
}: {
  blocks: { kind: string; title: string; minutes: number }[]
  className?: string
}) {
  const still = useReducedMotion()
  const total = blocks.reduce((s, b) => s + b.minutes, 0) || 1
  const tone: Record<string, string> = {
    lektion: 'bg-accent',
    wiederholung: 'bg-pos',
    gemischt: 'bg-oxide',
    klausur: 'bg-ink',
    fehler: 'bg-neg',
    ruhe: 'bg-ruleStrong',
  }

  if (blocks.length === 0) return null

  return (
    <div className={className}>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {blocks.map((b, i) => (
          <motion.span
            key={i}
            className={`${tone[b.kind] ?? 'bg-ruleStrong'} rounded-full`}
            title={`${b.title} · ${Math.round(b.minutes)} min`}
            initial={still ? false : { width: 0 }}
            animate={{ width: `${(b.minutes / total) * 100}%` }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.1 }}
          />
        ))}
      </div>
    </div>
  )
}
