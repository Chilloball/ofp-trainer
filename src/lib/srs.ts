import type { Grade, ItemState } from './types'

/* ==================================================================== *
 *  Lernwissenschaftlicher Kern
 *
 *  1) Spaced Repetition nach dem FSRS-Modell (Free Spaced Repetition
 *     Scheduler). Statt eines festen Intervallfaktors (SM-2) werden pro
 *     Aufgabe zwei latente Größen geführt:
 *       • stability  S  – Zeit in Tagen, nach der die Abrufwahrschein-
 *                         lichkeit auf 90 % gefallen ist
 *       • difficulty D  – 1..10, wie schwer die Aufgabe für DICH ist
 *     Die Vergessenskurve ist ein Potenzgesetz (Ebbinghaus, moderne
 *     Nachbildung durch FSRS):
 *          R(t) = (1 + F · t/S)^DECAY
 *     Das ist empirisch deutlich besser als die Exponentialkurve.
 *
 *  2) Desirable Difficulty: Wiederholung genau dann, wenn die Abruf-
 *     wahrscheinlichkeit auf ~90 % gefallen ist (retention target).
 *     Kurz vor der Klausur wird das Ziel angehoben, damit am Prüfungstag
 *     alles frisch ist.
 *
 *  3) Testing Effect: aktives Abrufen (Aufgabe lösen) zählt stärker als
 *     passives Lesen — deshalb hat Lesen keinen Einfluss auf S.
 * ==================================================================== */

const DECAY = -0.5
const FACTOR = 19 / 81 // so dass R(S) = 0.9

/** Standard-Retentionsziel; steigt näher an der Klausur. */
export function retentionTarget(daysToExam: number): number {
  if (daysToExam <= 3) return 0.97
  if (daysToExam <= 7) return 0.95
  if (daysToExam <= 21) return 0.92
  return 0.9
}

/** Abrufwahrscheinlichkeit nach `elapsedDays` bei Stabilität `s`. */
export function retrievability(elapsedDays: number, s: number): number {
  if (s <= 0) return 0
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / s, DECAY)
}

/** Intervall in Tagen, bis R auf `target` gefallen ist. */
export function intervalForTarget(s: number, target: number): number {
  return (s / FACTOR) * (Math.pow(target, 1 / DECAY) - 1)
}

/* --------- FSRS-Parameter (verkürzter, robuster Parametersatz) -------- */
const W = {
  initS: [0.4, 1.2, 3.2, 8.0], // Stabilität nach der ERSTEN Bewertung je Grade
  initD: [7.4, 6.0, 4.9, 3.4], // Startschwierigkeit je Grade
  dDelta: 1.05, // wie stark D pro Grade-Schritt wandert
  dMeanRev: 0.08, // Rückzug zur mittleren Schwierigkeit
  sInc: 2.6, // Skalierung des Stabilitätszuwachses
  sDiff: 0.72, // Einfluss der Schwierigkeit
  sRet: 0.9, // Einfluss der aktuellen Retrievability
  hardPenalty: 0.62,
  easyBonus: 1.35,
  lapseS: [0.12, 1.9, 0.55], // Stabilität nach einem Lapse
  minS: 0.05,
  maxS: 3650,
}

function clampD(d: number) {
  return Math.min(10, Math.max(1, d))
}

export function newItemState(exerciseId: string, topicId: string): ItemState {
  return {
    exerciseId,
    topicId,
    stability: 0,
    difficulty: 5,
    reps: 0,
    lapses: 0,
    lastReview: null,
    due: Date.now(),
    history: [],
    mastery: 0,
  }
}

/**
 * Aktualisiert den Zustand einer Aufgabe nach einer Bewertung.
 * `grade`: 0 = nochmal, 1 = schwer, 2 = gut, 3 = leicht
 */
export function review(
  state: ItemState,
  grade: Grade,
  opts: { now?: number; score: number; ms: number; daysToExam: number },
): ItemState {
  const now = opts.now ?? Date.now()
  const elapsedDays = state.lastReview ? (now - state.lastReview) / 86_400_000 : 0
  const first = state.reps === 0

  let S: number
  let D: number

  if (first) {
    S = W.initS[grade]
    D = clampD(W.initD[grade])
  } else {
    const R = retrievability(elapsedDays, state.stability)
    D = clampD(state.difficulty - W.dDelta * (grade - 2) + W.dMeanRev * (5 - state.difficulty))

    if (grade === 0) {
      // Lapse: Stabilität bricht ein, aber nicht auf 0
      S = Math.max(
        W.minS,
        W.lapseS[0] * Math.pow(D, -0.3) * (Math.pow(state.stability + 1, W.lapseS[1] * 0.2) - 1) * Math.exp((1 - R) * W.lapseS[2]),
      )
      S = Math.min(S, state.stability)
    } else {
      const hard = grade === 1 ? W.hardPenalty : 1
      const easy = grade === 3 ? W.easyBonus : 1
      const inc =
        1 +
        Math.exp(W.sInc) *
          (11 - D) *
          Math.pow(state.stability, -0.35) *
          (Math.exp((1 - R) * W.sRet) - 1) *
          hard *
          easy *
          0.012 *
          Math.pow(D, -W.sDiff + 0.72)
      S = state.stability * Math.max(1.02, inc)
    }
  }

  S = Math.min(W.maxS, Math.max(W.minS, S))

  const target = retentionTarget(opts.daysToExam)
  let intervalDays = intervalForTarget(S, target)
  // Fuzzing gegen Klumpenbildung, ±8 %
  intervalDays *= 0.92 + ((now % 1000) / 1000) * 0.16
  // Nie über die Klausur hinaus planen
  if (opts.daysToExam > 0) intervalDays = Math.min(intervalDays, Math.max(0.2, opts.daysToExam - 0.5))
  intervalDays = Math.max(grade === 0 ? 0.007 : 0.02, intervalDays) // "nochmal" ≈ 10 Minuten

  const history = [{ t: now, score: opts.score, ms: opts.ms, grade }, ...state.history].slice(0, 12)

  return {
    ...state,
    stability: S,
    difficulty: D,
    reps: state.reps + 1,
    lapses: state.lapses + (grade === 0 ? 1 : 0),
    lastReview: now,
    due: now + intervalDays * 86_400_000,
    history,
    mastery: itemMastery({ ...state, stability: S, difficulty: D, history, lastReview: now }, now),
  }
}

/**
 * Beherrschungsgrad einer einzelnen Aufgabe (0..1).
 *
 * Kombiniert
 *   • Leistung  – gewichteter Mittelwert der letzten Ergebnisse (neuere zählen mehr)
 *   • Haltbarkeit – wie lange hält das Wissen (aus der Stabilität)
 *   • Frische   – aktuelle Abrufwahrscheinlichkeit
 */
export function itemMastery(state: ItemState, now = Date.now()): number {
  if (state.history.length === 0) return 0
  let wSum = 0
  let sSum = 0
  state.history.forEach((h, i) => {
    const w = Math.pow(0.62, i)
    wSum += w
    sSum += w * h.score
  })
  const performance = sSum / wSum

  const durability = 1 - Math.exp(-state.stability / 21) // 21 Tage ≈ solide
  const elapsed = state.lastReview ? (now - state.lastReview) / 86_400_000 : 0
  const fresh = state.stability > 0 ? retrievability(elapsed, state.stability) : 0

  const m = 0.55 * performance + 0.27 * durability + 0.18 * fresh
  // Eine einzige richtige Antwort soll noch keine Meisterschaft bedeuten
  const confidence = 1 - Math.exp(-state.reps / 2.2)
  return Math.max(0, Math.min(1, m * (0.45 + 0.55 * confidence)))
}

/** Ergebnis (0..1) + Hilfsnutzung → Bewertungsstufe. */
export function scoreToGrade(score: number, opts: { usedHints: number; revealed: boolean; slow: boolean }): Grade {
  if (opts.revealed || score < 0.35) return 0
  if (score < 0.7 || opts.usedHints >= 2) return 1
  if (score < 0.999 || opts.usedHints === 1 || opts.slow) return 2
  return 3
}

export function daysUntil(iso: string, now = Date.now()): number {
  return (new Date(iso).getTime() - now) / 86_400_000
}
