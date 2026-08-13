import type { ExerciseMeta, UserProgress } from './types'
import { TOPICS, TOPIC_BY_ID, EXAM_DATE, examWeight } from '@/content/topics'
import { daysUntil, itemMastery, retrievability } from './srs'
import { calendarDaysUntil } from './day'

/* ==================================================================== *
 *  Themen-Beherrschung, Klausur-Readiness und adaptive Aufgabenwahl
 * ==================================================================== */

/** Gewicht einer Aufgabe innerhalb ihres Themas – schwere Aufgaben zählen mehr. */
function difficultyWeight(d: number): number {
  return [0, 0.6, 0.85, 1.15, 1.4, 1.55][d] ?? 1
}

export interface TopicMastery {
  topicId: string
  /** 0..1 – wie gut beherrscht */
  mastery: number
  /** 0..1 – wie viel des Themas wurde überhaupt schon angefasst */
  coverage: number
  /** Anzahl Aufgaben, Anzahl gesehen, Anzahl fällig */
  total: number
  seen: number
  due: number
  /** erwartete Trefferquote in der Klausur (mit Vergessen bis dahin) */
  projected: number
  /** Punkteverlust-Erwartung in der Klausur, in Prozentpunkten der Gesamtklausur */
  riskPoints: number
  weight: number
  strongest: boolean
  weakest: boolean
}

export function topicMastery(
  progress: UserProgress,
  exercisesByTopic: Record<string, ExerciseMeta[]>,
  now = Date.now(),
): Record<string, TopicMastery> {
  const dte = Math.max(0, daysUntil(EXAM_DATE, now))
  const out: Record<string, TopicMastery> = {}

  for (const topic of TOPICS) {
    const list = exercisesByTopic[topic.id] ?? []
    const total = list.length
    let wSum = 0
    let mSum = 0
    let pSum = 0
    let seen = 0
    let due = 0

    for (const ex of list) {
      const w = difficultyWeight(ex.difficulty)
      wSum += w
      const st = progress.items[ex.id]
      if (!st || st.reps === 0) continue
      seen++
      if (st.due <= now) due++
      const m = itemMastery(st, now)
      mSum += w * m
      // Projektion auf den Klausurtag: wie viel ist dann noch abrufbar?
      const elapsedAtExam = (now - (st.lastReview ?? now)) / 86_400_000 + dte
      const rAtExam = st.stability > 0 ? retrievability(elapsedAtExam, st.stability) : 0
      const recentScore = st.history.length ? st.history[0].score : 0
      pSum += w * Math.min(1, recentScore * (0.35 + 0.65 * rAtExam))
    }

    const mastery = wSum > 0 ? mSum / wSum : 0
    const projected = wSum > 0 ? pSum / wSum : 0
    const coverage = total > 0 ? seen / total : 0
    const weight = examWeight(topic.id)

    out[topic.id] = {
      topicId: topic.id,
      mastery,
      coverage,
      total,
      seen,
      due,
      projected,
      riskPoints: weight * (1 - projected) * 100,
      weight,
      strongest: false,
      weakest: false,
    }
  }

  const ranked = Object.values(out)
    .filter((t) => (TOPIC_BY_ID[t.topicId]?.relevance ?? 'core') !== 'low')
    .sort((a, b) => a.mastery - b.mastery)
  ranked.slice(0, 3).forEach((t) => (out[t.topicId].weakest = true))
  ranked.slice(-3).forEach((t) => (out[t.topicId].strongest = true))

  return out
}

export interface Readiness {
  /** 0..100 – erwartete Klausurpunkte in Prozent */
  score: number
  /** 0..100 – ohne Vergessens-Projektion (aktueller Stand) */
  current: number
  python: number
  java: number
  /** vorhergesagte Note nach üblichem Notenschlüssel */
  grade: string
  /** wie viel Prozentpunkte durch bloßes Wiederholen fälliger Aufgaben zu holen wären */
  quickWin: number
  coverage: number
  daysToExam: number
  /** Themen sortiert nach Punkteverlust-Risiko */
  risks: TopicMastery[]
}

/** Notenschlüssel: 50 % = 4.0, 100 % = 1.0, linear in 5 %-Schritten (übliche Praxis). */
export function percentToGrade(p: number): string {
  const table: [number, string][] = [
    [95, '1.0'], [90, '1.3'], [85, '1.7'], [80, '2.0'], [75, '2.3'],
    [70, '2.7'], [65, '3.0'], [60, '3.3'], [55, '3.7'], [50, '4.0'],
  ]
  for (const [min, g] of table) if (p >= min) return g
  return '5.0'
}

export function readiness(
  progress: UserProgress,
  exercisesByTopic: Record<string, ExerciseMeta[]>,
  now = Date.now(),
): Readiness {
  const tm = topicMastery(progress, exercisesByTopic, now)
  let projected = 0
  let current = 0
  let py = 0
  let pyW = 0
  let jv = 0
  let jvW = 0
  let cov = 0
  let covW = 0

  for (const t of Object.values(tm)) {
    const topic = TOPIC_BY_ID[t.topicId]
    projected += t.weight * t.projected
    current += t.weight * t.mastery
    covW += t.weight
    cov += t.weight * t.coverage
    if (topic.lang === 'python') {
      py += t.weight * t.projected
      pyW += t.weight
    } else {
      jv += t.weight * t.projected
      jvW += t.weight
    }
  }

  const score = Math.round(projected * 100)
  // Was wäre erreichbar, wenn heute alle fälligen Aufgaben wiederholt würden?
  const quickWin = Math.round(
    Object.values(tm).reduce((s, t) => s + (t.due > 0 ? t.weight * (t.mastery - t.projected) : 0), 0) * 100,
  )

  return {
    score,
    current: Math.round(current * 100),
    python: pyW > 0 ? Math.round((py / pyW) * 100) : 0,
    java: jvW > 0 ? Math.round((jv / jvW) * 100) : 0,
    grade: percentToGrade(score),
    quickWin: Math.max(0, quickWin),
    coverage: covW > 0 ? Math.round((cov / covW) * 100) : 0,
    daysToExam: calendarDaysUntil(EXAM_DATE, now),
    risks: Object.values(tm).sort((a, b) => b.riskPoints - a.riskPoints),
  }
}

/* ------------------------- Adaptive Auswahl ------------------------- */

export interface PickOptions {
  /** Wie viele Aufgaben soll die Session enthalten? */
  count: number
  /** Filter */
  lang?: 'python' | 'java' | 'both'
  topicIds?: string[]
  mode: 'adaptive' | 'due' | 'weakest' | 'new' | 'exam' | 'topic' | 'mistakes'
  now?: number
}

/**
 * Kernstück der Adaptivität.
 *
 * Jede Aufgabe bekommt einen Nutzwert. Er kombiniert:
 *  • Fälligkeit (Spacing)                       → Wissen sichern
 *  • Themen-Risiko × Klausurgewicht             → dort lernen, wo es zählt
 *  • Desirable Difficulty (85-%-Regel)          → optimale Herausforderung
 *  • Neuheit                                    → Abdeckung erhöhen
 *  • Fehler-Historie                            → gezielt an Lücken arbeiten
 *  • Interleaving-Bonus                         → Themen mischen statt blocken
 */
export function pickExercises(
  progress: UserProgress,
  all: ExerciseMeta[],
  opts: PickOptions,
): ExerciseMeta[] {
  const now = opts.now ?? Date.now()
  const byTopic: Record<string, ExerciseMeta[]> = {}
  for (const e of all) (byTopic[e.topicId] ??= []).push(e)
  const tm = topicMastery(progress, byTopic, now)

  let pool = all
  if (opts.lang && opts.lang !== 'both') pool = pool.filter((e) => e.lang === opts.lang)
  if (opts.topicIds?.length) pool = pool.filter((e) => opts.topicIds!.includes(e.topicId))
  if (opts.mode === 'new') pool = pool.filter((e) => !progress.items[e.id]?.reps)
  if (opts.mode === 'due') pool = pool.filter((e) => (progress.items[e.id]?.due ?? Infinity) <= now)
  if (opts.mode === 'exam') pool = pool.filter((e) => e.examStyle)
  if (opts.mode === 'mistakes')
    pool = pool.filter((e) => {
      const st = progress.items[e.id]
      return st && (st.lapses > 0 || (st.history[0]?.score ?? 1) < 0.7 || st.flagged)
    })
  if (opts.mode === 'weakest') {
    const weak = Object.values(tm)
      .filter((t) => TOPIC_BY_ID[t.topicId]?.relevance !== 'low')
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 4)
      .map((t) => t.topicId)
    pool = pool.filter((e) => weak.includes(e.topicId))
  }

  if (pool.length === 0) pool = all

  const scored = pool.map((e) => {
    const st = progress.items[e.id]
    const topic = TOPIC_BY_ID[e.topicId]
    const tms = tm[e.topicId]

    // --- Fälligkeit ---
    let dueScore = 0
    if (st?.reps) {
      const overdueDays = (now - st.due) / 86_400_000
      dueScore = overdueDays >= 0 ? 1 + Math.min(1.6, Math.log1p(overdueDays)) : Math.max(0, 0.35 + overdueDays * 0.28)
    }

    // --- Neuheit ---
    const novelty = st?.reps ? 0 : 0.85 + (tms.coverage < 0.5 ? 0.35 : 0)

    // --- Klausur-Relevanz ---
    const relevanceBoost =
      ({ core: 1.0, likely: 0.78, edge: 0.5, low: 0.2 } as Record<string, number>)[topic?.relevance ?? 'core'] ?? 1
    const stakes = (tms?.weight ?? 0.02) * 16 * relevanceBoost

    // --- Desirable Difficulty: Ziel ist eine Erfolgsquote um 85 % ---
    const skill = tms?.mastery ?? 0
    const target = 0.15 + skill * 0.85 // welche normierte Schwierigkeit passt gerade?
    const norm = (e.difficulty - 1) / 4
    const fit = Math.exp(-Math.pow(norm - target, 2) / (2 * 0.22 * 0.22))

    // --- Fehler-Historie ---
    const lastScore = st?.history[0]?.score ?? null
    const errorBoost = st ? (st.lapses > 0 ? 0.55 : 0) + (lastScore !== null && lastScore < 0.7 ? 0.5 : 0) : 0
    const flagBoost = st?.flagged ? 0.8 : 0
    const starPenalty = st?.starred ? -0.6 : 0

    // --- Klausurformat bevorzugen, je näher die Klausur rückt ---
    const dte = Math.max(1, daysUntil(EXAM_DATE, now))
    const examBoost = e.examStyle ? Math.min(0.9, 14 / dte) * 0.6 : 0

    // --- Sättigung: gut beherrschte Aufgaben nicht wiederholt anbieten ---
    const saturation = st ? -1.2 * Math.pow(st.mastery, 2.2) : 0

    const utility =
      1.5 * dueScore +
      1.0 * novelty +
      1.0 * stakes +
      1.1 * fit +
      errorBoost +
      flagBoost +
      starPenalty +
      examBoost +
      saturation +
      Math.random() * 0.22 // leichte Zufälligkeit gegen Monotonie

    return { e, utility, topicId: e.topicId }
  })

  scored.sort((a, b) => b.utility - a.utility)

  /* Interleaving: aus den besten Kandidaten so auswählen, dass nie mehr als
     zwei Aufgaben desselben Themas direkt hintereinander kommen. Blocked
     practice fühlt sich leichter an, interleaved practice überträgt besser
     (Rohrer & Taylor). */
  const chosen: ExerciseMeta[] = []
  const perTopic: Record<string, number> = {}
  const maxPerTopic = Math.max(2, Math.ceil(opts.count / 3))
  const rest: typeof scored = []

  for (const c of scored) {
    if (chosen.length >= opts.count) break
    const n = perTopic[c.topicId] ?? 0
    const lastTwoSame =
      chosen.length >= 2 &&
      chosen[chosen.length - 1].topicId === c.topicId &&
      chosen[chosen.length - 2].topicId === c.topicId
    if (n >= maxPerTopic || lastTwoSame) {
      rest.push(c)
      continue
    }
    chosen.push(c.e)
    perTopic[c.topicId] = n + 1
  }
  for (const c of rest) {
    if (chosen.length >= opts.count) break
    chosen.push(c.e)
  }

  return chosen.slice(0, opts.count)
}

/* --------------------------- Lernplan --------------------------- */

export interface PlanDay {
  date: string
  label: string
  daysLeft: number
  focusTopics: { topicId: string; title: string; minutes: number; why: string }[]
  totalMinutes: number
  milestone?: string
}

/**
 * Erzeugt einen Lernplan bis zur Klausur. Verteilt die verfügbare Zeit
 * nach Risiko (Klausurgewicht × Wissenslücke) und plant die letzten Tage
 * bewusst als Wiederholungs- und Probeklausur-Phase.
 */
export function studyPlan(
  progress: UserProgress,
  exercisesByTopic: Record<string, ExerciseMeta[]>,
  minutesPerDay: number,
  now = Date.now(),
): PlanDay[] {
  const tm = topicMastery(progress, exercisesByTopic, now)
  const dte = Math.max(1, Math.ceil(daysUntil(EXAM_DATE, now)))
  const days: PlanDay[] = []
  const horizon = Math.min(dte, 45)

  // Risiko-Budget je Thema
  const risks = Object.values(tm)
    .filter((t) => TOPIC_BY_ID[t.topicId])
    .map((t) => ({ ...t, topic: TOPIC_BY_ID[t.topicId] }))
    .sort((a, b) => b.riskPoints - a.riskPoints)

  for (let i = 0; i < horizon; i++) {
    const d = new Date(now + i * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    const daysLeft = dte - i
    const phase = daysLeft <= 3 ? 'final' : daysLeft <= 8 ? 'exam' : daysLeft <= 18 ? 'consolidate' : 'build'

    let picks: { topicId: string; title: string; minutes: number; why: string }[] = []
    let milestone: string | undefined

    if (phase === 'final') {
      milestone = daysLeft <= 1 ? 'Nur noch Wiederholung — nichts Neues mehr!' : 'Komplette Probeklausur unter Zeitdruck'
      picks = risks.slice(0, 3).map((r) => ({
        topicId: r.topicId,
        title: r.topic.title,
        minutes: Math.round(minutesPerDay / 3),
        why: 'Letzte Auffrischung der riskantesten Themen',
      }))
    } else if (phase === 'exam') {
      milestone = i % 2 === 0 ? 'Probeklausur (ein Teil, 60 Minuten)' : 'Fehleranalyse der letzten Probeklausur'
      picks = risks.slice(0, 3).map((r, k) => ({
        topicId: r.topicId,
        title: r.topic.title,
        minutes: Math.round((minutesPerDay * [0.45, 0.3, 0.25][k]) as number),
        why: 'Klausurformat trainieren',
      }))
    } else {
      // rotierende Schwerpunkte, damit Themen wiederkehren (Spacing)
      const rot = risks.slice(0, 8)
      const a = rot[i % Math.max(1, rot.length)]
      const b = rot[(i + 3) % Math.max(1, rot.length)]
      const c = rot[(i + 5) % Math.max(1, rot.length)]
      picks = [a, b, c].filter(Boolean).map((r, k) => ({
        topicId: r.topicId,
        title: r.topic.title,
        minutes: Math.round(minutesPerDay * [0.5, 0.3, 0.2][k]),
        why:
          k === 0
            ? phase === 'build'
              ? 'Hauptthema des Tages — größte Punktelücke'
              : 'Vertiefen'
            : 'Wiederholung (Spacing)',
      }))
      if (phase === 'consolidate' && i % 3 === 0) milestone = 'Mini-Klausur: 10 Aufgaben im Prüfungsformat'
    }

    days.push({
      date: iso,
      label: d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      daysLeft,
      focusTopics: picks,
      totalMinutes: picks.reduce((s, p) => s + p.minutes, 0),
      milestone,
    })
  }

  return days
}
