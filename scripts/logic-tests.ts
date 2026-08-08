/* Testfälle für die Logik abseits des Compilers: Tagesrechnung,
   Sicherungsdateien, Aufgabenauswahl, Klausur-Baupläne.
   Aufruf: npm run test:logic */
import { readFileSync } from 'node:fs'
import { dayKey, previousDayKey, lastDayKeys } from '../src/lib/day'
import { emptyProgress, mergeProgress } from '../src/lib/storage'
import { pickExercises } from '../src/lib/mastery'
import { newItemState, review } from '../src/lib/srs'
import type { ContentIndex, UserProgress } from '../src/lib/types'

const index: ContentIndex = JSON.parse(readFileSync('public/content/index.json', 'utf8'))

let passed = 0
const failures: string[] = []

function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++
  else failures.push(`✗ ${name}${detail ? '\n  ' + detail : ''}`)
}

/* ------------------------------ Tagesrechnung ------------------------------ */

{
  // 1. Januar, 00:30 Uhr Ortszeit — nach UTC gerechnet wäre das der 31. Dezember
  const nachMitternacht = new Date(2026, 0, 1, 0, 30)
  check('Tagesschlüssel nutzt Ortszeit', dayKey(nachMitternacht) === '2026-01-01', dayKey(nachMitternacht))
  check('Vortag über Jahreswechsel', previousDayKey(nachMitternacht) === '2025-12-31', previousDayKey(nachMitternacht))

  // Sommerzeitumstellung: Ende März verliert ein Tag eine Stunde
  const keys = lastDayKeys(5, new Date(2026, 2, 31, 10))
  check('letzte Tage sind lückenlos und aufsteigend',
    keys.join(',') === '2026-03-27,2026-03-28,2026-03-29,2026-03-30,2026-03-31', keys.join(','))
  check('keine doppelten Tage', new Set(keys).size === keys.length)
}

/* --------------------------- Sicherung und Zusammenführen --------------------------- */

{
  const a = emptyProgress('A')
  const b = emptyProgress('B')
  const meta = index.items[0]

  a.items[meta.id] = { ...newItemState(meta.id, meta.topicId), lastReview: 1000, reps: 1, mastery: 0.3 }
  b.items[meta.id] = { ...newItemState(meta.id, meta.topicId), lastReview: 2000, reps: 4, mastery: 0.9 }
  a.days['2026-08-01'] = { done: 3, minutes: 5, correct: 2 }
  b.days['2026-08-01'] = { done: 7, minutes: 9, correct: 5 }
  b.days['2026-08-02'] = { done: 2, minutes: 3, correct: 1 }

  const m = mergeProgress(a, b)
  check('Zusammenführen behält den neueren Eintrag', m.items[meta.id].reps === 4, `reps=${m.items[meta.id].reps}`)
  check('Zusammenführen nimmt den höheren Tageswert', m.days['2026-08-01'].done === 7)
  check('Zusammenführen ergänzt fehlende Tage', m.days['2026-08-02'].done === 2)
  check('Zusammenführen behält einen Namen', m.name === 'A')

  const leer = mergeProgress(emptyProgress(), emptyProgress())
  check('Zusammenführen zweier leerer Stände bleibt leer', Object.keys(leer.items).length === 0)
}

/* ----------------------------- Aufgabenauswahl ----------------------------- */

{
  const modi = ['adaptive', 'due', 'weakest', 'new', 'mistakes', 'exam', 'topic'] as const
  for (const mode of modi) {
    let doppelt = 0
    let leer = 0
    for (let i = 0; i < 40; i++) {
      const picked = pickExercises(emptyProgress(), index.items, { count: 10, mode, lang: 'both' })
      const ids = picked.map((p) => p.id)
      if (new Set(ids).size !== ids.length) doppelt++
      if (ids.length === 0) leer++
    }
    check(`Auswahl «${mode}» liefert keine Doppelten`, doppelt === 0, `${doppelt} von 40 Runden`)
    check(`Auswahl «${mode}» liefert überhaupt Aufgaben`, leer === 0, `${leer} von 40 Runden leer`)
  }

  // mit Vorgeschichte: alles einmal beantwortet
  const geuebt: UserProgress = emptyProgress()
  for (const it of index.items.slice(0, 120)) {
    geuebt.items[it.id] = review(newItemState(it.id, it.topicId), 2, {
      now: Date.now() - 5 * 86_400_000, score: 1, ms: 20_000, daysToExam: 20,
    })
  }
  const nachher = pickExercises(geuebt, index.items, { count: 10, mode: 'adaptive', lang: 'both' })
  check('Auswahl mit Vorgeschichte liefert 10 Aufgaben', nachher.length === 10, String(nachher.length))
  check('Auswahl mit Vorgeschichte ohne Doppelte', new Set(nachher.map((p) => p.id)).size === nachher.length)

  // Sprachfilter
  const nurPy = pickExercises(emptyProgress(), index.items, { count: 12, mode: 'adaptive', lang: 'python' })
  check('Sprachfilter Python greift', nurPy.every((p) => p.lang === 'python'))
  const nurJava = pickExercises(emptyProgress(), index.items, { count: 12, mode: 'adaptive', lang: 'java' })
  check('Sprachfilter Java greift', nurJava.every((p) => p.lang === 'java'))

  // Themenfilter
  for (const topicId of ['py-recursion', 'java-inheritance', 'java-io-threads']) {
    const t = pickExercises(emptyProgress(), index.items, { count: 8, mode: 'topic', topicIds: [topicId] })
    check(`Themenfilter «${topicId}» greift`, t.length > 0 && t.every((p) => p.topicId === topicId))
  }
}

/* ------------------------------ Klausur-Baupläne ------------------------------ */

{
  for (const exam of index.exams) {
    const full = JSON.parse(readFileSync(`public/content/exams/${exam.id}.json`, 'utf8'))
    let slots = 0
    for (const task of full.tasks ?? []) {
      if (task.inline?.length) slots += task.inline.length
      else if (task.exerciseIds?.length) slots += task.exerciseIds.length
      else if (task.blueprint) {
        const bp = task.blueprint
        const types = bp.type ? (Array.isArray(bp.type) ? bp.type : [bp.type]) : null
        const pool = index.items.filter(
          (m) =>
            bp.topicIds.includes(m.topicId) &&
            (!types || types.includes(m.type)) &&
            (!bp.minDifficulty || m.difficulty >= bp.minDifficulty) &&
            (!bp.maxDifficulty || m.difficulty <= bp.maxDifficulty),
        )
        check(`${exam.id}/${task.id}: genug Aufgaben im Bauplan`, pool.length >= bp.count,
          `${pool.length} verfügbar, ${bp.count} nötig`)
        slots += Math.min(bp.count, pool.length)
      }
    }
    check(`${exam.id}: enthält Aufgaben`, slots > 0, `${slots} Aufgabenplätze`)
  }
}

console.log(`Logik: ${passed}/${passed + failures.length} Prüfungen bestanden`)
if (failures.length) {
  console.log('\n' + failures.join('\n'))
  process.exit(1)
}
