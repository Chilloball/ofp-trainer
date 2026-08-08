'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { EASE } from './ui'

/* ==================================================================== *
 *  Darstellungen, die beim Lernen helfen
 *
 *  Jede Grafik hier beantwortet eine konkrete Frage:
 *    Ring      — wie stehe ich insgesamt, und wo hängt es (Python/Java)?
 *    Meter     — wie weit bin ich in dieser einen Sache?
 *    Kalender  — habe ich regelmäßig geübt?
 *    Themenkarte — wo liegen die Klausurpunkte, und wo verliere ich sie?
 *    Diff      — worin genau weicht meine Ausgabe von der richtigen ab?
 * ==================================================================== */

type Tone = 'accent' | 'brass' | 'ok' | 'warn' | 'bad' | 'py' | 'java' | 'line'

const STROKE: Record<Tone, string> = {
  accent: 'rgb(var(--accent))',
  brass: 'rgb(var(--brass))',
  ok: 'rgb(var(--ok))',
  warn: 'rgb(var(--warn))',
  bad: 'rgb(var(--bad))',
  py: 'rgb(var(--py))',
  java: 'rgb(var(--java))',
  line: 'rgb(var(--line))',
}

const FILL: Record<Tone, string> = {
  accent: 'bg-accent', brass: 'bg-brass', ok: 'bg-ok', warn: 'bg-warn',
  bad: 'bg-bad', py: 'bg-py', java: 'bg-java', line: 'bg-line',
}

export function toneFor(value: number, seen = true): Tone {
  if (!seen) return 'line'
  if (value >= 0.75) return 'ok'
  if (value >= 0.4) return 'warn'
  return 'bad'
}

/* -------------------------------- Balken -------------------------------- */

export function Meter({
  value,
  tone = 'accent',
  className = '',
  delay = 0,
}: {
  value: number
  tone?: Tone
  className?: string
  delay?: number
}) {
  const still = useReducedMotion()
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className={`meter ${className}`}>
      <motion.span
        className={FILL[tone]}
        initial={still ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.75, ease: EASE, delay }}
      />
    </div>
  )
}

/* --------------------------------- Ring --------------------------------- */

export interface RingArc {
  value: number
  tone: Tone
  label: string
}

/**
 * Der äußere Ring zeigt die Gesamtprognose, die beiden inneren die
 * Sprachhälften. So sieht man in einem Blick nicht nur „wie viel",
 * sondern auch „woran es liegt".
 */
export function Ring({
  value,
  size = 168,
  tone,
  arcs = [],
  children,
}: {
  value: number
  size?: number
  tone?: Tone
  arcs?: RingArc[]
  children?: React.ReactNode
}) {
  const still = useReducedMotion()
  const t = tone ?? toneFor(value)
  const stroke = 11
  const gap = 7
  const rings = [{ value, tone: t, w: stroke }, ...arcs.map((a) => ({ value: a.value, tone: a.tone, w: 5 }))]

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {rings.map((r, i) => {
          const radius = size / 2 - stroke / 2 - i * (gap + 5)
          const circ = 2 * Math.PI * radius
          const shown = Math.max(0, Math.min(1, r.value))
          return (
            <g key={i}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgb(var(--line))"
                strokeWidth={r.w}
                opacity={i === 0 ? 1 : 0.6}
              />
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={STROKE[r.tone]}
                strokeWidth={r.w}
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={still ? false : { strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ * (1 - shown) }}
                transition={{ duration: 1.05, ease: EASE, delay: 0.1 + i * 0.12 }}
              />
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/* ------------------------------ Sparkline ------------------------------ */

export function Sparkline({
  values,
  width = 120,
  height = 30,
  tone = 'accent',
}: {
  values: number[]
  width?: number
  height?: number
  tone?: Tone
}) {
  const still = useReducedMotion()
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const step = width / (values.length - 1)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - (v / max) * (height - 3) - 1.5}`).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.path
        d={d}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={still ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </svg>
  )
}

/* --------------------------- Aktivitätskalender --------------------------- */

/** Wie bei Beitragsgrafiken: Regelmäßigkeit wird auf einen Blick sichtbar. */
export function ActivityCalendar({
  days,
  weeks = 20,
  goal = 15,
}: {
  days: Record<string, { done: number }>
  weeks?: number
  goal?: number
}) {
  const still = useReducedMotion()
  const cells = useMemo(() => {
    const out: { iso: string; done: number; label: string; future: boolean }[] = []
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    // bis zum Ende der laufenden Woche auffüllen (Montag als Wochenstart)
    const weekday = (today.getDay() + 6) % 7
    const end = new Date(today.getTime() + (6 - weekday) * 86_400_000)
    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86_400_000)
      const iso = d.toISOString().slice(0, 10)
      out.push({
        iso,
        done: days[iso]?.done ?? 0,
        label: d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long' }),
        future: d.getTime() > today.getTime(),
      })
    }
    return out
  }, [days, weeks])

  const months: { col: number; name: string }[] = []
  cells.forEach((c, i) => {
    if (i % 7 !== 0) return
    const m = new Date(c.iso).toLocaleDateString('de-DE', { month: 'short' })
    if (!months.length || months[months.length - 1].name !== m) months.push({ col: i / 7, name: m })
  })

  const level = (done: number) => {
    if (done === 0) return 0
    if (done < goal * 0.34) return 1
    if (done < goal * 0.67) return 2
    if (done < goal) return 3
    return 4
  }
  const bg = ['bg-line', 'bg-brass/25', 'bg-brass/45', 'bg-brass/70', 'bg-brass']

  const cols = `repeat(${weeks}, minmax(9px, 1fr))`

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="inline-block min-w-full">
        {/* Monatsnamen sitzen exakt über der Spalte, in der der Monat beginnt */}
        <div className="mb-1.5 grid gap-[3px] text-[10.5px] text-faint" style={{ gridTemplateColumns: cols }}>
          {Array.from({ length: weeks }).map((_, w) => (
            <span key={w} className="relative h-3.5">
              {months.find((x) => x.col === w) && (
                <span className="absolute left-0 top-0 whitespace-nowrap">
                  {months.find((x) => x.col === w)!.name}
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: cols }}>
          {cells.map((c, i) => (
            <motion.div
              key={c.iso}
              title={`${c.label}: ${c.done} ${c.done === 1 ? 'Aufgabe' : 'Aufgaben'}`}
              className={`aspect-square rounded-[3px] ${c.future ? 'bg-line/40' : bg[level(c.done)]}`}
              initial={still ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.0016, 0.5) }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-faint">
          <span>weniger</span>
          {bg.map((b, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${b}`} />
          ))}
          <span>mehr</span>
          <span className="ml-auto">Tagesziel {goal}</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Themenkarte ------------------------------ */

export interface TopicTile {
  id: string
  title: string
  short: string
  lang: 'python' | 'java'
  /** Anteil an der Klausur, 0..1 */
  weight: number
  /** Beherrschung, 0..1 */
  mastery: number
  seen: number
  total: number
}

/**
 * Die Fläche eines Feldes entspricht seinem Punktegewicht in der Klausur,
 * die Füllung dem Lernstand. Große blasse Felder sind genau die Stellen,
 * an denen am meisten liegen bleibt.
 */
export function TopicMap({
  tiles,
  href,
  totalPoints = 103,
}: {
  tiles: TopicTile[]
  href: (id: string) => string
  /** Gesamtpunkte der Klausur — damit auf den Feldern echte Punkte stehen */
  totalPoints?: number
}) {
  const still = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  const sorted = [...tiles].sort((a, b) => b.weight - a.weight)

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((t, i) => {
        const grow = Math.max(1, Math.round(t.weight * 260))
        const tone = toneFor(t.mastery, t.seen > 0)
        return (
          <motion.div
            key={t.id}
            style={{ flexGrow: grow, flexBasis: `${Math.max(84, grow * 1.5)}px` }}
            initial={still ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE, delay: Math.min(i * 0.025, 0.4) }}
            onHoverStart={() => setHover(t.id)}
            onHoverEnd={() => setHover(null)}
          >
            <Link
              href={href(t.id)}
              className="group relative block h-[84px] overflow-hidden rounded-lg border border-line bg-sunken p-2.5
                         transition-[border-color,transform] duration-200 hover:border-lineStrong"
              title={`${t.title} — rund ${Math.round(t.weight * totalPoints)} Klausurpunkte, ${t.seen} von ${t.total} Aufgaben bearbeitet, ${Math.round(t.mastery * 100)} % beherrscht`}
            >
              {/* Füllstand von unten */}
              <motion.span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 ${FILL[tone]} ${t.seen ? 'opacity-22' : 'opacity-0'}`}
                initial={still ? false : { height: 0 }}
                animate={{ height: `${Math.max(4, t.mastery * 100)}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.15 + Math.min(i * 0.02, 0.3) }}
              />
              <span className="relative flex h-full flex-col justify-between gap-1">
                <span className="line-clamp-2 text-[12.5px] font-medium leading-[1.25]">{t.short}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.lang === 'python' ? 'bg-py' : 'bg-java'}`} />
                  <span className="tabnum text-[11px] text-muted">
                    {t.seen ? `${Math.round(t.mastery * 100)} %` : '—'}
                  </span>
                  <span className="tabnum ml-auto shrink-0 text-[10.5px] text-faint">
                    {hover === t.id ? `${t.seen}/${t.total}` : `${Math.round(t.weight * totalPoints)} P`}
                  </span>
                </span>
              </span>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ------------------------------ Ausgabe-Diff ------------------------------ */

interface DiffLine {
  kind: 'same' | 'wrong' | 'missing' | 'extra'
  expected?: string
  got?: string
  n: number
}

function lineDiff(expected: string[], got: string[]): DiffLine[] {
  /* Längste gemeinsame Teilfolge — damit eine eingeschobene oder fehlende
     Zeile nicht alles danach als falsch markiert. */
  const m = expected.length
  const n = got.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = expected[i] === got[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  let n0 = 0
  while (i < m && j < n) {
    if (expected[i] === got[j]) {
      out.push({ kind: 'same', expected: expected[i], got: got[j], n: ++n0 })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      /* Zeile fehlt in der Antwort — falls direkt danach eine überzählige
         folgt, als „falsch" zusammenfassen, das liest sich besser. */
      if (j < n && lcs[i + 1][j] === lcs[i][j + 1]) {
        out.push({ kind: 'wrong', expected: expected[i], got: got[j], n: ++n0 })
        i++
        j++
      } else {
        out.push({ kind: 'missing', expected: expected[i], n: ++n0 })
        i++
      }
    } else {
      out.push({ kind: 'extra', got: got[j], n: ++n0 })
      j++
    }
  }
  while (i < m) out.push({ kind: 'missing', expected: expected[i++], n: ++n0 })
  while (j < n) out.push({ kind: 'extra', got: got[j++], n: ++n0 })
  return out
}

/** Zeichenweiser Vergleich innerhalb einer Zeile. */
function charSpans(a: string, b: string) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return { start, endA, endB }
}

/**
 * Zeigt Soll und Ist zeichengenau nebeneinander. Beim Lernen ist die
 * Frage fast nie „falsch oder richtig", sondern „an welcher Stelle genau" —
 * ein fehlendes Leerzeichen sieht man im Fließtext sonst nicht.
 */
export function OutputDiff({
  expected,
  got,
  className = '',
}: {
  expected: string
  got: string
  className?: string
}) {
  const still = useReducedMotion()
  const rows = useMemo(
    () => lineDiff(expected.replace(/\s+$/, '').split('\n'), got.replace(/\s+$/, '').split('\n')),
    [expected, got],
  )
  const wrong = rows.filter((r) => r.kind !== 'same').length

  return (
    <div className={`overflow-hidden rounded-lg border border-line ${className}`}>
      <div className="flex items-center gap-3 border-b border-line bg-sunken px-3 py-2">
        <span className="eyebrow">Vergleich</span>
        <span className="text-[11.5px] text-muted">
          {wrong === 0 ? 'alle Zeilen stimmen' : `${wrong} von ${rows.length} Zeilen weichen ab`}
        </span>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-ok/60" /> erwartet
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-bad/60" /> deine Ausgabe
          </span>
        </span>
      </div>
      <div className="max-h-80 overflow-auto bg-surface font-mono text-[12.5px] leading-[1.7]">
        {rows.map((r, idx) => {
          const ok = r.kind === 'same'
          const spans = r.kind === 'wrong' ? charSpans(r.expected ?? '', r.got ?? '') : null
          return (
            <motion.div
              key={idx}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.3) }}
              className={`grid grid-cols-[2.2rem_1fr] border-b border-line/60 last:border-0 ${
                ok ? '' : 'bg-bad/4'
              }`}
            >
              <span className="select-none border-r border-line/60 px-2 py-1 text-right text-[11px] text-faint">
                {r.n}
              </span>
              <span className="min-w-0 px-2.5 py-1">
                {ok ? (
                  <span className="whitespace-pre-wrap break-words text-muted">{r.expected || ' '}</span>
                ) : (
                  <span className="block space-y-0.5">
                    {r.expected !== undefined && (
                      <span className="block whitespace-pre-wrap break-words">
                        <span className="mr-1.5 select-none text-ok">soll</span>
                        {spans ? (
                          <>
                            {r.expected.slice(0, spans.start)}
                            <mark className="rounded-sm bg-ok/25 px-px text-ink">
                              {visible(r.expected.slice(spans.start, spans.endA))}
                            </mark>
                            {r.expected.slice(spans.endA)}
                          </>
                        ) : (
                          <mark className="rounded-sm bg-ok/20 px-px text-ink">{visible(r.expected)}</mark>
                        )}
                      </span>
                    )}
                    {r.got !== undefined && (
                      <span className="block whitespace-pre-wrap break-words">
                        <span className="mr-1.5 select-none text-bad">ist&nbsp;</span>
                        {spans ? (
                          <>
                            {r.got.slice(0, spans.start)}
                            <mark className="rounded-sm bg-bad/25 px-px text-ink">
                              {visible(r.got.slice(spans.start, spans.endB))}
                            </mark>
                            {r.got.slice(spans.endB)}
                          </>
                        ) : (
                          <mark className="rounded-sm bg-bad/20 px-px text-ink">{visible(r.got)}</mark>
                        )}
                      </span>
                    )}
                    {r.kind === 'missing' && (
                      <span className="block text-[11px] text-faint">diese Zeile fehlt in deiner Ausgabe</span>
                    )}
                    {r.kind === 'extra' && (
                      <span className="block text-[11px] text-faint">diese Zeile ist zu viel</span>
                    )}
                  </span>
                )}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/** Macht leere Abweichungen sichtbar — sonst sieht man ein fehlendes Zeichen nicht. */
function visible(s: string) {
  if (s === '') return <span className="text-faint">∅</span>
  if (s.trim() === '') return <span className="text-faint">{'␣'.repeat(s.length)}</span>
  return s
}

/* --------------------------- Punkte in der Klausur --------------------------- */

/**
 * Eine Leiste über alle Themen: Breite = Punktegewicht, gefüllter Teil =
 * was du davon voraussichtlich holst. Der ungefüllte Rest ist genau das,
 * was in der Klausur liegen bleibt.
 */
export function PointsBar({
  segments,
}: {
  segments: { id: string; title: string; weight: number; mastery: number; lang: 'python' | 'java' }[]
}) {
  const still = useReducedMotion()
  const total = segments.reduce((s, x) => s + x.weight, 0) || 1
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-line bg-sunken">
        {segments.map((s, i) => (
          <div
            key={s.id}
            className="relative border-r border-paper/60 last:border-0"
            style={{ width: `${(s.weight / total) * 100}%` }}
            title={`${s.title}: ${Math.round((s.weight / total) * 100)} % der Punkte, ${Math.round(s.mastery * 100)} % beherrscht`}
          >
            <motion.span
              className={`absolute inset-x-0 bottom-0 ${s.lang === 'python' ? 'bg-py' : 'bg-java'}`}
              initial={still ? false : { height: 0 }}
              animate={{ height: `${Math.max(3, s.mastery * 100)}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.1 + Math.min(i * 0.02, 0.35) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-py" /> Python
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-java" /> Java
        </span>
        <span>Breite = Punktegewicht in der Klausur · Füllhöhe = dein Stand</span>
      </div>
    </div>
  )
}
