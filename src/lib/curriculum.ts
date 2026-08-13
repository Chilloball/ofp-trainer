import type { ExerciseMeta, ExerciseType, Lang, UserProgress } from './types'
import { EXAM_DATE, TOPICS, examWeight } from '@/content/topics'
import { topicMastery, type TopicMastery } from './mastery'
import { calendarDaysUntil, dayKey } from './day'

/* ==================================================================== *
 *  DER LERNPLAN
 *
 *  Diese Datei beantwortet eine einzige Frage: „Was mache ich jetzt,
 *  damit ich am 31. August fertig bin?" — und zwar so, dass die Antwort
 *  begründbar ist.
 *
 *  Die Anordnung folgt vier Befunden aus der Lernforschung:
 *
 *  1) VERTEILTES LERNEN und ABRUFÜBUNG sind von zehn untersuchten
 *     Lerntechniken die beiden wirksamsten (Dunlosky u. a. 2013;
 *     Donoghue & Hattie 2021, 242 Studien / 169 179 Teilnehmende).
 *     Deshalb hat JEDER Tag einen Wiederholungsblock, und deshalb
 *     besteht auch eine „neue" Lektion überwiegend aus Aufgaben und
 *     nicht aus Lesestoff.
 *
 *  2) VERSCHRÄNKEN (interleaving) überträgt besser als Blocklernen —
 *     es fühlt sich beim Üben schlechter an und sitzt hinterher besser.
 *     Deshalb wird ab der zweiten Phase über Themen hinweg gemischt,
 *     statt ein Thema am Stück durchzuarbeiten.
 *
 *  3) GELÖSTE BEISPIELE MIT ABNEHMENDER HILFE sind für Anfänger
 *     effizienter als freies Problemlösen (Cognitive Load Theory).
 *     Deshalb beginnt jede Lektion mit Verstehen und endet mit einem
 *     Prüfstück im Klausurformat — nicht umgekehrt.
 *
 *  4) Der Plan wird bei JEDEM Aufruf neu gerechnet. Ein Lernplan, der
 *     nach drei Tagen nicht mehr stimmt, ist schlimmer als keiner.
 * ==================================================================== */

const DAY = 86_400_000

/** Voreingestellte Puffertage vor der Klausur. */
export const DEFAULT_BUFFER = 4

/* -------------------------- Aufwandsschätzung -------------------------- */

/** Grundaufwand je Aufgabentyp in Minuten (Erfahrungswerte dieses Kurses). */
const BASE_MINUTES: Record<ExerciseType, number> = {
  mc: 0.8,
  'multi-mc': 1.3,
  'predict-output': 2.2,
  'fill-gaps': 2.0,
  'short-answer': 2.0,
  'find-errors': 2.6,
  uml: 4.0,
  code: 6.0,
}

export function exerciseMinutes(meta: ExerciseMeta): number {
  return (BASE_MINUTES[meta.type] ?? 2) * (0.75 + meta.difficulty * 0.1)
}

/* ------------------------------ Lektionen ------------------------------ */

/**
 * Der Anteil der Aufgaben eines Themas, den man gesehen haben muss,
 * damit die Lektion als durchgearbeitet gilt. Nicht 100 %: die letzten
 * Aufgaben eines Themas bringen kaum noch neues Wissen, kosten aber
 * genauso viel Zeit. Sie bleiben als Reserve für die Wiederholung.
 */
export const GATE_COVERAGE = 0.55
/** Beherrschungsgrad, ab dem ein Thema als „sitzt" gilt. */
export const GATE_MASTERY = 0.72

export interface Lesson {
  id: string
  topicId: string
  title: string
  summary: string
  lang: Lang
  /** Position im Kurs (folgt der Vorlesung, respektiert Vorwissen) */
  order: number
  lecture: string
  /** Anteil an den Klausurpunkten, 0..1 */
  weight: number
  /** ungefähre Klausurpunkte dieses Themas */
  points: number
  /** Aufgaben im Bestand */
  total: number
  /** Aufgaben, die für das Gate zu bearbeiten sind */
  planned: number
  /** geschätzte Minuten für Theorie + geplante Aufgaben */
  minutes: number
  prereqs: string[]
  relevance: string
}

/** Gesamtpunkte, auf die die Gewichte normiert sind (Python 49 + Java 54). */
export const EXAM_POINTS = 103

export function buildLessons(metaByTopic: Record<string, ExerciseMeta[]>): Lesson[] {
  return TOPICS.map((t) => {
    const list = metaByTopic[t.id] ?? []
    const total = list.length
    const planned = Math.max(1, Math.ceil(total * GATE_COVERAGE))
    const avg = list.length ? list.reduce((s, m) => s + exerciseMinutes(m), 0) / list.length : 2.5
    const theory = Math.min(14, 4 + t.subtopics.length * 1.4)
    const weight = examWeight(t.id)
    return {
      id: `lektion-${t.id}`,
      topicId: t.id,
      title: t.title,
      summary: t.summary,
      lang: t.lang,
      order: t.order,
      lecture: t.lecture,
      weight,
      points: Math.round(weight * EXAM_POINTS),
      total,
      planned,
      minutes: Math.round(theory + planned * avg),
      prereqs: t.prereqs ?? [],
      relevance: t.relevance,
    }
  }).sort((a, b) => a.order - b.order)
}

export type LessonStatus =
  /** noch nicht angefasst */
  | 'offen'
  /** angefangen, Gate noch nicht erreicht */
  | 'laufend'
  /** Gate erreicht */
  | 'sitzt'
  /** Gate war erreicht, das Wissen verblasst gerade */
  | 'auffrischen'

export interface LessonState extends Lesson {
  status: LessonStatus
  mastery: number
  coverage: number
  seen: number
  due: number
  /** wie viele Aufgaben noch fehlen, bis das Gate greift */
  remaining: number
  /** Restaufwand in Minuten */
  remainingMinutes: number
  /** erwarteter Punkteverlust in der Klausur, wenn es so bleibt */
  riskPoints: number
  /** Vorwissen, das noch nicht sitzt (nur Hinweis, keine Sperre) */
  missingPrereqs: string[]
}

export function lessonStates(
  lessons: Lesson[],
  mastery: Record<string, TopicMastery>,
): LessonState[] {
  const passed = new Set(
    lessons
      .filter((l) => {
        const m = mastery[l.topicId]
        return m && m.coverage >= GATE_COVERAGE && m.mastery >= GATE_MASTERY
      })
      .map((l) => l.topicId),
  )

  return lessons.map((l) => {
    const m = mastery[l.topicId]
    const cov = m?.coverage ?? 0
    const mas = m?.mastery ?? 0
    const seen = m?.seen ?? 0
    const due = m?.due ?? 0

    let status: LessonStatus
    if (seen === 0) status = 'offen'
    else if (cov >= GATE_COVERAGE && mas >= GATE_MASTERY) status = due > 0 ? 'auffrischen' : 'sitzt'
    else status = 'laufend'

    const remaining = Math.max(0, l.planned - seen)
    const perTask = l.total > 0 ? (l.minutes - 6) / Math.max(1, l.planned) : 2.5

    return {
      ...l,
      status,
      mastery: mas,
      coverage: cov,
      seen,
      due,
      remaining,
      remainingMinutes: Math.round(remaining * Math.max(1, perTask) + (seen === 0 ? 6 : 0)),
      riskPoints: m?.riskPoints ?? l.weight * EXAM_POINTS,
      missingPrereqs: l.prereqs.filter((p) => !passed.has(p)),
    }
  })
}

/* ------------------------------- Phasen ------------------------------- */

export type Phase = 'aufbau' | 'verzahnen' | 'klausurformat' | 'puffer' | 'vorbei'

export interface PhaseInfo {
  id: Phase
  title: string
  goal: string
  /** Anteil der Tageszeit für neuen Stoff (Rest: Wiederholung/Klausur) */
  newShare: number
}

export const PHASES: Record<Phase, PhaseInfo> = {
  aufbau: {
    id: 'aufbau',
    title: 'Aufbau',
    goal: 'Jedes Thema einmal richtig durcharbeiten — Lektion für Lektion in der Reihenfolge der Vorlesung.',
    newShare: 0.65,
  },
  verzahnen: {
    id: 'verzahnen',
    title: 'Verzahnen',
    goal: 'Themen gemischt üben statt am Stück. Fühlt sich schwerer an und überträgt nachweislich besser.',
    newShare: 0.3,
  },
  klausurformat: {
    id: 'klausurformat',
    title: 'Klausurformat',
    goal: 'Probeklausuren unter Zeitdruck, danach jeden Fehler einzeln nacharbeiten.',
    newShare: 0.1,
  },
  puffer: {
    id: 'puffer',
    title: 'Puffer',
    goal: 'Ab hier soll der Stoff sitzen. Diese Tage sind Reserve: nur noch auffrischen — oder aufholen, falls etwas dazwischenkam.',
    newShare: 0,
  },
  vorbei: {
    id: 'vorbei',
    title: 'Nach der Klausur',
    goal: 'Der Termin liegt hinter dir.',
    newShare: 0,
  },
}

/**
 * Phasengrenzen hängen an der VERBLEIBENDEN Zeit, nicht an einem festen
 * Datum — damit der Plan auch für jemanden funktioniert, der drei Tage
 * vor der Klausur anfängt (dann beginnt er direkt im Klausurformat).
 */
/**
 * Ordnet einem Tag seine Phase zu.
 *
 * Der Stoff soll `buffer` Tage VOR der Klausur fertig sein, nicht am
 * Klausurtag. Alles davor wird über das verbleibende Arbeitsfenster
 * verteilt; die Puffertage danach sind Reserve.
 */
export function phaseFor(daysLeft: number, totalDays: number, buffer = DEFAULT_BUFFER): Phase {
  if (daysLeft <= 0) return 'vorbei'
  const b = Math.max(0, Math.min(buffer, Math.max(0, totalDays - 3)))
  if (daysLeft <= b) return 'puffer'

  /* Tage, die für echte Arbeit bleiben. */
  const work = daysLeft - b
  const span = Math.max(4, totalDays - b)
  /* Die Grenzen sind kumulativ — sonst frisst eine Phase die nächste auf
     und für „Klausurformat" bliebe ein einziger Tag übrig. */
  const klausur = Math.max(3, Math.round(span * 0.16))
  const verzahnen = klausur + Math.max(4, Math.round(span * 0.24))
  if (work <= klausur) return 'klausurformat'
  if (work <= verzahnen) return 'verzahnen'
  return 'aufbau'
}

/* ------------------------------ Tagesplan ------------------------------ */

export type BlockKind = 'lektion' | 'wiederholung' | 'gemischt' | 'klausur' | 'fehler' | 'ruhe'

export interface PlanBlock {
  kind: BlockKind
  title: string
  /** Die Begründung. Ein Plan, dessen Schritte man nicht versteht, wird nicht befolgt. */
  why: string
  minutes: number
  count: number
  topicIds: string[]
  href: string
}

export interface PlanDay {
  /** YYYY-MM-DD */
  date: string
  label: string
  weekday: string
  daysLeft: number
  phase: Phase
  blocks: PlanBlock[]
  minutes: number
  milestone?: string
  isToday: boolean
  isPast: boolean
  /** an vergangenen Tagen: tatsächlich bearbeitete Aufgaben */
  actuallyDone: number
}

export interface Feasibility {
  /** Restaufwand aller offenen Lektionen, in Minuten */
  requiredMinutes: number
  /** verfügbare Zeit bis zur Klausur nach Abzug der Wiederholungsreserve */
  availableMinutes: number
  fits: boolean
  /** fehlende Minuten, falls es nicht aufgeht */
  shortfallMinutes: number
  /** Minuten pro Tag, die nötig wären, damit es aufgeht */
  neededPerDay: number
  /** Themen, die man bei Zeitnot zuerst streichen sollte (schwächstes Verhältnis Punkte/Aufwand) */
  cutCandidates: LessonState[]
}

export interface Plan {
  phase: Phase
  daysLeft: number
  totalDays: number
  /** Puffertage vor der Klausur, an denen nichts Neues mehr geplant wird */
  bufferDays: number
  /** Tage bis zum Stichtag „Stoff fertig" (= daysLeft − bufferDays) */
  readyInDays: number
  /** Datum, an dem der Stoff sitzen soll, z. B. „27.08." */
  readyByLabel: string
  lessons: LessonState[]
  /** die als Nächstes dran ist */
  nextLesson: LessonState | null
  days: PlanDay[]
  today: PlanDay
  feasibility: Feasibility
  /** Lektionen, deren Gate erreicht ist */
  passed: number
}

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/**
 * Reihenfolge der offenen Lektionen.
 *
 * Reicht die Zeit, ist die Sache einfach: die Reihenfolge der Vorlesung.
 * Reicht sie NICHT, muss nach Punkten pro Minute vorgezogen werden —
 * aber nicht blind, sonst landet „Vererbung" vor „Objekte" und der
 * Lernende sitzt vor einer Aufgabe, deren Grundlage er nicht hat.
 *
 * Deshalb eine topologische Auswahl: In jedem Schritt kommt die
 * ertragreichste Lektion dran, DEREN VORWISSEN bereits sitzt oder
 * schon eingeplant ist. Nur wenn gar nichts frei ist (Zyklus oder
 * fehlendes Vorwissen außerhalb der Auswahl), wird die Sperre gelöst.
 */
function orderQueue(open: LessonState[], all: LessonState[], fits: boolean): LessonState[] {
  const byOrder = [...open].sort((a, b) => a.order - b.order)
  if (fits) return byOrder

  const passed = new Set(all.filter((l) => l.status === 'sitzt' || l.status === 'auffrischen').map((l) => l.topicId))
  const remaining = new Map(byOrder.map((l) => [l.topicId, l]))
  const out: LessonState[] = []
  const value = (l: LessonState) => l.points / Math.max(1, l.remainingMinutes)

  while (remaining.size > 0) {
    const free = [...remaining.values()].filter((l) => l.prereqs.every((p) => passed.has(p) || !remaining.has(p)))
    const pool = free.length > 0 ? free : [...remaining.values()]
    pool.sort((a, b) => {
      const d = value(b) - value(a)
      return Math.abs(d) > 0.02 ? d : a.order - b.order
    })
    const pick = pool[0]
    out.push(pick)
    passed.add(pick.topicId)
    remaining.delete(pick.topicId)
  }
  return out
}

function fmtDay(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}

const href = {
  lesson: (topicId: string, count: number) => `/ueben?thema=${topicId}&laenge=${count}`,
  due: (count: number) => `/ueben?modus=due&laenge=${count}`,
  mixed: (topicIds: string[], count: number) =>
    `/ueben?modus=weakest&themen=${topicIds.join(',')}&laenge=${count}`,
  mistakes: (count: number) => `/ueben?modus=mistakes&laenge=${count}`,
  examFormat: (count: number) => `/ueben?modus=exam&laenge=${count}`,
  exams: () => '/klausur',
}

/**
 * Baut den Plan von heute bis zum Klausurtag.
 *
 * Der Plan ist bewusst KEINE gespeicherte Liste, die man abhakt: er wird
 * aus dem aktuellen Lernstand neu erzeugt. Wer einen Tag auslässt, findet
 * am nächsten Tag keinen Rückstand vor, sondern einen angepassten Plan.
 */
export function buildPlan(
  progress: UserProgress,
  metaByTopic: Record<string, ExerciseMeta[]>,
  now = Date.now(),
): Plan {
  const mastery = topicMastery(progress, metaByTopic, now)
  const lessons = buildLessons(metaByTopic)
  const states = lessonStates(lessons, mastery)

  const daysLeft = Math.max(0, calendarDaysUntil(EXAM_DATE, now))
  const start = progress.createdAt || now
  const totalDays = Math.max(daysLeft, calendarDaysUntil(EXAM_DATE, start))
  const minutesPerDay = Math.max(15, Math.round(progress.settings.dailyGoal * 2.4))

  /* Der Stoff soll VOR der Klausur fertig sein. Bei sehr wenig Zeit
     schrumpft der Puffer, aber die letzten zwei Tage bleiben immer
     lernfrei von Neuem — Neues am Vorabend hilft niemandem. */
  const wish = progress.settings.bufferDays ?? DEFAULT_BUFFER
  const bufferDays = Math.max(0, Math.min(wish, Math.max(0, daysLeft - 3)))
  const readyInDays = Math.max(0, daysLeft - bufferDays)
  const readyDate = new Date(now + readyInDays * DAY)
  const readyByLabel = fmtDay(readyDate)

  /* ------------------------- Machbarkeit ------------------------- */

  const open = states.filter((l) => l.status === 'offen' || l.status === 'laufend')
  const requiredMinutes = open.reduce((s, l) => s + l.remainingMinutes, 0)
  /* 30 % der Zeit sind für Wiederholung und Probeklausuren reserviert —
     ohne diese Reserve wäre der Plan zwar „geschafft", das Wissen am
     Klausurtag aber wieder weg. */
  const availableMinutes = Math.round(readyInDays * minutesPerDay * 0.7)
  const shortfallMinutes = Math.max(0, requiredMinutes - availableMinutes)

  const cutCandidates = [...open]
    .sort((a, b) => a.points / Math.max(1, a.remainingMinutes) - b.points / Math.max(1, b.remainingMinutes))
    .slice(0, 4)

  const feasibility: Feasibility = {
    requiredMinutes,
    availableMinutes,
    fits: shortfallMinutes === 0,
    shortfallMinutes,
    neededPerDay: readyInDays > 0 ? Math.ceil(requiredMinutes / 0.7 / readyInDays) : requiredMinutes,
    cutCandidates,
  }

  /* --------------------------- Tage bauen --------------------------- */

  const queue = orderQueue(open, states, feasibility.fits)

  const risky = [...states]
    .filter((l) => l.relevance !== 'low')
    .sort((a, b) => b.riskPoints - a.riskPoints)

  const dueNow = states.reduce((s, l) => s + l.due, 0)
  const horizon = Math.min(Math.max(daysLeft, 1), 60)
  const days: PlanDay[] = []

  let qi = 0
  let examCount = 0

  for (let i = 0; i < horizon; i++) {
    const date = new Date(now + i * DAY)
    const iso = dayKey(date)
    const left = daysLeft - i
    const phase = phaseFor(left, totalDays, bufferDays)
    const blocks: PlanBlock[] = []
    let milestone: string | undefined

    const newBudget = Math.round(minutesPerDay * PHASES[phase].newShare)
    const restBudget = minutesPerDay - newBudget

    /* --- Neuer Stoff --- */
    if (newBudget > 0) {
      let spent = 0
      while (spent < newBudget * 0.7 && qi < queue.length) {
        const l = queue[qi]
        const take = Math.min(l.remaining, Math.max(4, Math.round((newBudget - spent) / 2.5)))
        if (take <= 0) {
          qi++
          continue
        }
        const mins = Math.round(take * 2.6 + (l.seen === 0 ? 6 : 0))
        blocks.push({
          kind: 'lektion',
          title: l.title,
          why:
            l.seen === 0
              ? `Neu. ${l.points} Klausurpunkte hängen an diesem Thema — erst Theorie lesen, dann ${take} Aufgaben.`
              : `Angefangen, aber noch nicht sicher (${Math.round(l.mastery * 100)} %). Noch ${l.remaining} Aufgaben bis zum Ziel.`,
          minutes: mins,
          count: take,
          topicIds: [l.topicId],
          href: href.lesson(l.topicId, take),
        })
        spent += mins
        /* Pro Tag höchstens zwei neue Lektionen — mehr behält niemand. */
        qi++
        if (blocks.filter((b) => b.kind === 'lektion').length >= 2) break
      }
    }

    /* --- Wiederholung: an JEDEM Tag, das ist der wirksamste Teil --- */
    const reviewMinutes = Math.round(restBudget * (phase === 'aufbau' ? 1 : 0.55))
    if (reviewMinutes >= 6 && (i > 0 || dueNow > 0)) {
      const count = Math.max(5, Math.round(reviewMinutes / 1.9))
      blocks.push({
        kind: 'wiederholung',
        title: 'Fällige Wiederholung',
        why:
          i === 0 && dueNow > 0
            ? `${dueNow} Aufgaben stehen laut Vergessenskurve genau jetzt an — kurz vor dem Punkt, an dem du sie vergisst.`
            : 'Verteiltes Wiederholen ist die wirksamste der untersuchten Lerntechniken. Deshalb steht es an jedem Tag.',
        minutes: reviewMinutes,
        count,
        topicIds: [],
        href: href.due(count),
      })
    }

    /* --- Gemischte Runde: Verschränken über Themen hinweg --- */
    if (phase === 'verzahnen' || phase === 'klausurformat') {
      const pick = risky.slice(0, 4).map((l) => l.topicId)
      const mins = Math.round(restBudget * 0.45)
      const count = Math.max(6, Math.round(mins / 2.4))
      blocks.push({
        kind: 'gemischt',
        title: 'Gemischte Runde',
        why: `Vier Themen durcheinander (${risky.slice(0, 2).map((l) => l.title).join(', ')} …). Beim Üben unangenehmer, in der Klausur zuverlässiger.`,
        minutes: mins,
        count,
        topicIds: pick,
        href: href.mixed(pick, count),
      })
    }

    /* --- Probeklausuren und Fehlerarbeit --- */
    if (phase === 'klausurformat') {
      if (i % 2 === 0) {
        examCount++
        blocks.push({
          kind: 'klausur',
          title: `Probeklausur ${examCount}`,
          why: 'Unter Zeitdruck, in einem Stück. Erst hier zeigt sich, was unter Prüfungsbedingungen wirklich sitzt.',
          minutes: 60,
          count: 0,
          topicIds: [],
          href: href.exams(),
        })
        milestone = `Probeklausur ${examCount}`
      } else {
        blocks.push({
          kind: 'fehler',
          title: 'Fehler nacharbeiten',
          why: 'Jeder Fehler von gestern einzeln: was war falsch gedacht, welche Regel greift wirklich.',
          minutes: 30,
          count: 10,
          topicIds: [],
          href: href.mistakes(10),
        })
        milestone = 'Fehleranalyse'
      }
    }

    if (phase === 'puffer') {
      const pick = risky.slice(0, 3).map((l) => l.topicId)
      blocks.length = 0
      blocks.push({
        kind: 'wiederholung',
        title: 'Auffrischen statt Neues',
        why: 'Der Stoff ist durch. Was jetzt zählt, ist nur noch, dass es am Prüfungstag abrufbar ist.',
        minutes: Math.round(minutesPerDay * 0.6),
        count: Math.max(10, Math.round(minutesPerDay * 0.6 / 1.8)),
        topicIds: [],
        href: href.due(Math.max(10, Math.round((minutesPerDay * 0.6) / 1.8))),
      })
      blocks.push({
        kind: 'gemischt',
        title: 'Riskanteste Themen',
        why: `${risky
          .slice(0, 3)
          .map((l) => l.title)
          .join(', ')} — hier liegen laut Prognose die meisten Punkte auf der Straße.`,
        minutes: Math.round(minutesPerDay * 0.4),
        count: 10,
        topicIds: pick,
        href: href.mixed(pick, 10),
      })
      if (left <= 1) {
        blocks.length = 0
        blocks.push({
          kind: 'ruhe',
          title: 'Leicht wiederholen, früh schlafen',
          why: 'Am Tag vor der Prüfung bringt Pauken nichts mehr; Schlaf konsolidiert das Gelernte. Höchstens eine kurze Runde über deine Fehler.',
          minutes: 25,
          count: 10,
          topicIds: [],
          href: href.mistakes(10),
        })
        milestone = 'Morgen ist es so weit'
      }
    }

    /* --- Meilensteine --- */
    if (!milestone) {
      const doneAfter = queue.slice(0, qi)
      if (
        doneAfter.length > 0 &&
        doneAfter.every((l) => l.lang === 'python') &&
        qi < queue.length &&
        queue[qi]?.lang === 'java'
      ) {
        milestone = 'Python-Teil einmal durch'
      } else if (qi >= queue.length && queue.length > 0 && !days.some((d) => d.milestone === 'Alle Lektionen einmal durch')) {
        milestone = 'Alle Lektionen einmal durch'
      }
    }

    days.push({
      date: iso,
      label: fmtDay(date),
      weekday: WEEKDAY[date.getDay()],
      daysLeft: left,
      phase,
      blocks,
      minutes: blocks.reduce((s, b) => s + b.minutes, 0),
      milestone,
      isToday: i === 0,
      isPast: false,
      actuallyDone: progress.days[iso]?.done ?? 0,
    })
  }

  const nextLesson = queue[0] ?? null

  return {
    phase: phaseFor(daysLeft, totalDays, bufferDays),
    daysLeft,
    totalDays,
    bufferDays,
    readyInDays,
    readyByLabel,
    lessons: states,
    nextLesson,
    days,
    today: days[0] ?? {
      date: dayKey(new Date(now)),
      label: fmtDay(new Date(now)),
      weekday: WEEKDAY[new Date(now).getDay()],
      daysLeft: 0,
      phase: 'vorbei',
      blocks: [],
      minutes: 0,
      isToday: true,
      isPast: false,
      actuallyDone: 0,
    },
    feasibility,
    passed: states.filter((l) => l.status === 'sitzt' || l.status === 'auffrischen').length,
  }
}

/* ---------------------------- Nächster Schritt ---------------------------- */

export interface NextAction {
  kind: BlockKind | 'fertig'
  title: string
  why: string
  href: string
  minutes: number
  count: number
  topicId?: string
}

/**
 * Der eine nächste Schritt — die wichtigste Funktion der ganzen App.
 *
 * Die Reihenfolge ist keine Geschmacksfrage: Fälliges hat Vorrang vor
 * Neuem, weil verpasste Wiederholungen bereits Gelerntes kosten, während
 * ein Tag später begonnener Stoff nur später anfängt.
 */
export function nextAction(
  plan: Plan,
  progress: UserProgress,
  dueCount: number,
  todayCount: number,
): NextAction {
  const goal = progress.settings.dailyGoal
  const session = progress.settings.sessionLength

  if (plan.phase === 'vorbei') {
    return {
      kind: 'fertig',
      title: 'Der Klausurtermin liegt hinter dir',
      why: 'Du kannst weiter üben — der Plan rechnet aber nicht mehr auf ein Datum hin.',
      href: '/ueben',
      minutes: 10,
      count: session,
    }
  }

  /* 1) Wiederholung zuerst, sobald sich genug angesammelt hat. */
  if (dueCount >= Math.max(8, goal * 0.4)) {
    const count = Math.min(dueCount, Math.max(session, 12))
    return {
      kind: 'wiederholung',
      title: `${dueCount} Aufgaben sind zur Wiederholung fällig`,
      why: 'Sie stehen genau an dem Punkt, an dem das Wissen zu verblassen beginnt. Jetzt wiederholt kostet es zwei Minuten, in einer Woche musst du sie neu lernen.',
      href: href.due(count),
      minutes: Math.round(count * 1.9),
      count,
    }
  }

  /* 2) Endspurt: nichts Neues mehr. */
  if (plan.phase === 'puffer') {
    const b = plan.today.blocks[0]
    if (b) return { kind: b.kind, title: b.title, why: b.why, href: b.href, minutes: b.minutes, count: b.count }
  }

  /* 3) Die nächste Lektion. */
  if (plan.nextLesson) {
    const l = plan.nextLesson
    const take = Math.min(l.remaining, Math.max(session, 8))
    return {
      kind: 'lektion',
      title: l.seen === 0 ? `Lektion ${l.order}: ${l.title}` : `Weiter mit ${l.title}`,
      why:
        l.seen === 0
          ? `${l.points} von ${EXAM_POINTS} Klausurpunkten hängen hier. Noch nicht begonnen.`
          : `${Math.round(l.mastery * 100)} % sicher, noch ${l.remaining} Aufgaben bis zum Ziel.`,
      href: href.lesson(l.topicId, take),
      minutes: Math.round(take * 2.6),
      count: take,
      topicId: l.topicId,
    }
  }

  /* 4) Alles einmal durch → Klausurformat. */
  if (plan.phase === 'klausurformat' || plan.phase === 'verzahnen') {
    return {
      kind: 'klausur',
      title: 'Probeklausur schreiben',
      why: 'Alle Lektionen sind einmal durch. Was jetzt noch fehlt, zeigt sich nur unter Zeitdruck.',
      href: '/klausur',
      minutes: 60,
      count: 0,
    }
  }

  /* 5) Sonst: gemischt über die riskantesten Themen. */
  const risky = [...plan.lessons].sort((a, b) => b.riskPoints - a.riskPoints).slice(0, 4)
  const count = Math.max(session, 10)
  return {
    kind: 'gemischt',
    title: todayCount >= goal ? 'Noch eine Runde?' : 'Gemischte Runde',
    why:
      todayCount >= goal
        ? 'Dein Tagesziel steht. Eine Zusatzrunde über die riskantesten Themen schadet nie.'
        : `Vier Themen durcheinander: ${risky.map((l) => l.title).slice(0, 3).join(', ')}.`,
    href: href.mixed(risky.map((l) => l.topicId), count),
    minutes: Math.round(count * 2.4),
    count,
  }
}

/* ------------------------------- Anzeige ------------------------------- */

export const STATUS_LABEL: Record<LessonStatus, { label: string; tag: string }> = {
  offen: { label: 'offen', tag: 'tag' },
  laufend: { label: 'läuft', tag: 'tag tag-accent' },
  sitzt: { label: 'sitzt', tag: 'tag tag-ok' },
  auffrischen: { label: 'auffrischen', tag: 'tag tag-warn' },
}

export const BLOCK_LABEL: Record<BlockKind, string> = {
  lektion: 'Lektion',
  wiederholung: 'Wiederholung',
  gemischt: 'Gemischt',
  klausur: 'Probeklausur',
  fehler: 'Fehlerarbeit',
  ruhe: 'Ruhig angehen',
}

/** „1 h 20" statt „80 min" — ab einer Stunde liest sich das leichter. */
export function humanMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`
}
