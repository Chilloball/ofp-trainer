/* Testfälle für die Logik abseits des Compilers: Tagesrechnung,
   Sicherungsdateien, Aufgabenauswahl, Klausur-Baupläne.
   Aufruf: npm run test:logic */
import { readFileSync } from 'node:fs'
import { dayKey, previousDayKey, lastDayKeys } from '../src/lib/day'
import { emptyProgress, migrateProgress, mergeProgress } from '../src/lib/storage'
import { pickExercises, topicMastery } from '../src/lib/mastery'
import {
  buildLessons, buildPlan, lessonStates, nextAction, phaseFor, humanMinutes, GATE_COVERAGE, GATE_MASTERY,
} from '../src/lib/curriculum'
import { TOPIC_BY_ID } from '../src/content/topics'
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


/* -------------------------------- Lernplan -------------------------------- */

{
  const metaByTopic: Record<string, typeof index.items> = {}
  for (const i of index.items) (metaByTopic[i.topicId] ??= []).push(i)

  /* --- Phasen teilen die Zeit vollständig und ohne Lücke auf --- */
  for (const span of [7, 14, 23, 45, 90, 180]) {
    const seen = new Set<string>()
    let previous = ''
    let switches = 0
    for (let left = span; left >= 1; left--) {
      const ph = phaseFor(left, span)
      seen.add(ph)
      if (ph !== previous) {
        switches++
        previous = ph
      }
    }
    check(`Phasen bei ${span} Tagen wechseln nur vorwärts`, switches === seen.size,
      `${switches} Wechsel bei ${seen.size} Phasen`)
    check(`Phasen bei ${span} Tagen enthalten den Puffer`, seen.has('puffer'))
    check(`Phasen bei ${span} Tagen enthalten das Klausurformat`, seen.has('klausurformat'))
    if (span >= 23) check(`Phasen bei ${span} Tagen enthalten den Aufbau`, seen.has('aufbau'))
  }
  check('nach dem Termin gibt es keine Phase mehr', phaseFor(0, 30) === 'vorbei')

  /* --- Lektionen decken alle Themen ab --- */
  const lessons = buildLessons(metaByTopic)
  check('eine Lektion je Thema', lessons.length === Object.keys(TOPIC_BY_ID).length, `${lessons.length}`)
  check('Lektionen sind nach der Vorlesung sortiert',
    lessons.every((l, i) => i === 0 || lessons[i - 1].order <= l.order))
  check('jede Lektion hat geplante Aufgaben und Aufwand',
    lessons.every((l) => l.planned >= 1 && l.planned <= l.total && l.minutes > 0))
  check('Klausurpunkte der Lektionen ergeben rund die Gesamtpunktzahl',
    Math.abs(lessons.reduce((a, l) => a + l.points, 0) - 103) <= 6,
    `${lessons.reduce((a, l) => a + l.points, 0)}`)

  /* --- Frischer Stand: nichts sitzt, alles ist offen --- */
  const fresh = emptyProgress('Test')
  const states0 = lessonStates(lessons, topicMastery(fresh, metaByTopic))
  check('ohne Übung ist jede Lektion offen', states0.every((l) => l.status === 'offen'))
  check('ohne Übung fehlt überall der volle Umfang',
    states0.every((l) => l.remaining === l.planned))

  const plan0 = buildPlan(fresh, metaByTopic)
  check('Plan beginnt bei der ersten Lektion der Vorlesung',
    plan0.nextLesson?.order === 1, String(plan0.nextLesson?.order))
  check('Plan reicht bis zum Klausurtag', plan0.days.length === Math.min(Math.max(plan0.daysLeft, 1), 60))
  check('jeder Plantag hat einen Aufwand', plan0.days.every((d) => d.minutes >= 0))
  check('kein Plantag plant mehr als zwei neue Lektionen',
    plan0.days.every((d) => d.blocks.filter((b) => b.kind === 'lektion').length <= 2))
  check('jeder Block hat eine Begründung', plan0.days.every((d) => d.blocks.every((b) => b.why.length > 20)))
  check('jeder Block führt irgendwohin', plan0.days.every((d) => d.blocks.every((b) => b.href.startsWith('/'))))
  check('im Puffer kommt nichts Neues mehr',
    plan0.days.filter((d) => d.phase === 'puffer').every((d) => d.blocks.every((b) => b.kind !== 'lektion')))
  check('der Puffer liegt am Ende, nicht dazwischen',
    (() => {
      const idx = plan0.days.findIndex((d) => d.phase === 'puffer')
      return idx === -1 || plan0.days.slice(idx).every((d) => d.phase === 'puffer')
    })())
  check('Stichtag liegt vor der Klausur', plan0.readyInDays <= plan0.daysLeft)
  check('Puffer entspricht der Einstellung',
    plan0.bufferDays === Math.min(4, Math.max(0, plan0.daysLeft - 3)), String(plan0.bufferDays))
  check('nach dem Stichtag steht keine Lektion mehr an',
    plan0.days.filter((d) => d.daysLeft <= plan0.bufferDays).every((d) => d.blocks.every((b) => b.kind !== 'lektion')))

  /* --- Vorwissen wird auch unter Zeitdruck eingehalten --- */
  {
    const eilig = emptyProgress('Eilig')
    eilig.settings.dailyGoal = 4 // wenig Zeit → Umsortierung nach Punkten pro Minute
    const plan = buildPlan(eilig, metaByTopic)
    check('bei Zeitnot meldet der Plan die Lücke', !plan.feasibility.fits)
    const seen = new Set<string>()
    let ok = true
    /* Reihenfolge rekonstruieren: die Lektionsblöcke über alle Tage */
    for (const d of plan.days) {
      for (const b of d.blocks) {
        if (b.kind !== 'lektion') continue
        const topicId = b.topicIds[0]
        for (const p of TOPIC_BY_ID[topicId]?.prereqs ?? []) {
          if (!seen.has(p)) ok = false
        }
        seen.add(topicId)
      }
    }
    check('Umsortierung bei Zeitnot verletzt kein Vorwissen', ok)
  }

  /* --- Erledigte Lektion verschwindet aus der Warteschlange --- */
  {
    const geuebt = emptyProgress('Geübt')
    const first = lessons[0]
    const list = metaByTopic[first.topicId]
    const now = Date.now()
    for (const meta of list) {
      geuebt.items[meta.id] = {
        ...newItemState(meta.id, meta.topicId),
        reps: 4, stability: 40, difficulty: 4, lastReview: now - 86_400_000, due: now + 20 * 86_400_000,
        history: [3, 2, 1, 0].map((i) => ({ t: now - i * 86_400_000, score: 1, ms: 8000, grade: 3 as const })),
        mastery: 0.95,
      }
    }
    const st = lessonStates(lessons, topicMastery(geuebt, metaByTopic, now))
    const done = st.find((l) => l.topicId === first.topicId)!
    check('durchgearbeitete Lektion gilt als «sitzt»', done.status === 'sitzt', done.status)
    check('Gate greift erst über beiden Schwellen',
      done.coverage >= GATE_COVERAGE && done.mastery >= GATE_MASTERY,
      `cov=${done.coverage.toFixed(2)} mas=${done.mastery.toFixed(2)}`)
    const plan = buildPlan(geuebt, metaByTopic, now)
    check('erledigte Lektion ist nicht mehr die nächste', plan.nextLesson?.topicId !== first.topicId)
    check('erledigte Lektion zählt im Fortschritt', plan.passed >= 1)
  }

  /* --- Der nächste Schritt priorisiert Fälliges vor Neuem --- */
  {
    const p = emptyProgress('Fällig')
    const plan = buildPlan(p, metaByTopic)
    const ohneFaellig = nextAction(plan, p, 0, 0)
    check('ohne Fälliges kommt die nächste Lektion', ohneFaellig.kind === 'lektion', ohneFaellig.kind)
    const mitFaellig = nextAction(plan, p, 25, 0)
    check('mit vielen fälligen Aufgaben kommt zuerst die Wiederholung',
      mitFaellig.kind === 'wiederholung', mitFaellig.kind)
    check('der nächste Schritt hat immer ein Ziel', mitFaellig.href.startsWith('/'))
  }

  /* --- Zeitangaben --- */
  check('Minuten unter einer Stunde bleiben Minuten', humanMinutes(45) === '45 min')
  check('volle Stunden ohne Rest', humanMinutes(120) === '2 h')
  check('Stunden mit Rest zweistellig', humanMinutes(69) === '1 h 09')
}


/* ----------------- Bestehende Lernstände überleben Updates ----------------- */

{
  /* Ein Lernstand, wie er JETZT bei den drei Nutzern im Browser liegt:
     Schema 3, noch OHNE bufferDays und ohne confidence im Verlauf.
     Jedes künftige Update muss diesen Stand unverändert übernehmen —
     die drei lernen bereits aktiv damit. */
  const alt = {
    version: 3,
    name: 'Bestand',
    items: {
      'py-basics-001': {
        exerciseId: 'py-basics-001', topicId: 'py-basics', stability: 12.5, difficulty: 4.2,
        reps: 5, lapses: 1, lastReview: 1755000000000, due: 1756000000000, mastery: 0.82,
        history: [{ t: 1755000000000, score: 1, ms: 21000, grade: 2 }],
      },
    },
    topics: { 'py-basics': { topicId: 'py-basics', mastery: 0.8, seen: 12, correct: 10, attempts: 14, lastPracticed: 1755000000000, speed: 0.9 } },
    exams: [], log: [], days: { '2026-08-10': { done: 15, minutes: 40, correct: 12 } },
    streak: { current: 3, best: 5, lastDay: '2026-08-10' },
    scratch: { python: 'x = 1', java: '' },
    settings: { dailyGoal: 12, theme: 'dark', focus: 'balanced', showTimer: true, sessionLength: 10, onboarded: true },
    createdAt: 1754000000000, updatedAt: 1755000000000,
  }

  /* Über JSON.parse(JSON.stringify(...)), damit exakt das passiert,
     was beim Laden aus localStorage/IndexedDB passiert. */
  const wieder = migrateProgress(JSON.parse(JSON.stringify(alt)))!
  check('Bestandsdaten: Migration erkennt den Stand als gültig', wieder !== null)

  check('Bestandsdaten: Aufgabenstand bleibt exakt erhalten',
    wieder.items['py-basics-001']?.stability === 12.5 && wieder.items['py-basics-001']?.reps === 5)
  check('Bestandsdaten: Serie und Tage bleiben erhalten',
    wieder.streak.current === 3 && wieder.days['2026-08-10']?.done === 15)
  check('Bestandsdaten: Einstellungen bleiben, Neues bekommt Standardwerte',
    wieder.settings.dailyGoal === 12 && wieder.settings.theme === 'dark' && wieder.settings.bufferDays === 4)
  check('Bestandsdaten: Verlauf ohne confidence bleibt gültig',
    wieder.items['py-basics-001']?.history[0]?.grade === 2)
  check('Bestandsdaten: onboarded bleibt true — kein zweites Onboarding',
    wieder.settings.onboarded === true)
}

console.log(`Logik: ${passed}/${passed + failures.length} Prüfungen bestanden`)
if (failures.length) {
  console.log('\n' + failures.join('\n'))
  process.exit(1)
}
