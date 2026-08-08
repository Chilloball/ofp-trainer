#!/usr/bin/env node
/* ==================================================================== *
 *  Content-Pipeline
 *
 *  Wandelt den Autoren-Content (content/) in statische Assets um, die
 *  der Browser direkt laden kann (public/content/). Dadurch braucht die
 *  App keinen Server: sie lässt sich als reine Dateien ausliefern.
 *
 *    public/content/index.json          leichter Index aller Aufgaben
 *    public/content/exercises/<id>.json vollständige Aufgaben je Thema
 *    public/content/exams/<id>.json     Klausuren
 *    public/content/theory/<id>.md      Theorieteile
 * ==================================================================== */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'content')
const OUT = path.join(ROOT, 'public', 'content')

const problems = []
const warn = (m) => problems.push(m)

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function listTopicIds() {
  const src = await fs.readFile(path.join(ROOT, 'src', 'content', 'topics.ts'), 'utf8')
  return [...src.matchAll(/^\s{4}id:\s*'([a-z0-9-]+)',$/gm)].map((m) => m[1])
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true })
  await fs.mkdir(path.join(OUT, 'exercises'), { recursive: true })
  await fs.mkdir(path.join(OUT, 'exams'), { recursive: true })
  await fs.mkdir(path.join(OUT, 'theory'), { recursive: true })

  const topicIds = new Set(await listTopicIds())

  /* ------------------------------ Aufgaben ------------------------------ */
  const files = (await fs.readdir(path.join(SRC, 'exercises'))).filter((f) => f.endsWith('.json')).sort()
  const byTopic = new Map()
  const seen = new Set()
  let total = 0

  for (const f of files) {
    const raw = await readJson(path.join(SRC, 'exercises', f))
    const list = Array.isArray(raw) ? raw : (raw.exercises ?? [])
    for (const ex of list) {
      if (!ex?.id || !ex?.topicId || !ex?.prompt) {
        warn(`${f}: Aufgabe ohne id/topicId/prompt übersprungen`)
        continue
      }
      if (!topicIds.has(ex.topicId)) {
        warn(`${f}: unbekanntes Thema «${ex.topicId}» bei ${ex.id}`)
        continue
      }
      if (seen.has(ex.id)) {
        warn(`doppelte Aufgaben-ID «${ex.id}» (${f})`)
        continue
      }
      seen.add(ex.id)

      ex.difficulty = Math.min(5, Math.max(1, Number(ex.difficulty) || 3))
      ex.points = Number(ex.points) || ex.difficulty
      ex.hints = ex.hints ?? []
      ex.tags = ex.tags ?? []
      if (!ex.lang) ex.lang = ex.topicId.startsWith('py-') ? 'python' : 'java'

      if (ex.type === 'mc' || ex.type === 'multi-mc') {
        const correct = (ex.choices ?? []).filter((c) => c.correct).length
        if (ex.type === 'mc' && correct !== 1) warn(`${ex.id}: Single-Choice mit ${correct} richtigen Antworten`)
        if (ex.type === 'multi-mc' && correct < 1) warn(`${ex.id}: Mehrfachauswahl ohne richtige Antwort`)
      }
      if (ex.type === 'predict-output' && !ex.expectedOutput) warn(`${ex.id}: erwartete Ausgabe fehlt`)
      if (ex.type === 'fill-gaps' && !(ex.gaps ?? []).length) warn(`${ex.id}: keine Lücken definiert`)
      if (ex.type === 'find-errors' && !(ex.errors ?? []).length) warn(`${ex.id}: keine Fehlerliste`)
      if (!ex.solution) warn(`${ex.id}: keine Musterlösung`)

      if (!byTopic.has(ex.topicId)) byTopic.set(ex.topicId, [])
      byTopic.get(ex.topicId).push(ex)
      total++
    }
  }

  const items = []
  for (const [topicId, list] of byTopic) {
    list.sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    await fs.writeFile(path.join(OUT, 'exercises', `${topicId}.json`), JSON.stringify(list))
    for (const e of list) {
      items.push({
        id: e.id,
        topicId: e.topicId,
        lang: e.lang,
        type: e.type,
        difficulty: e.difficulty,
        points: e.points,
        title: e.title,
        ...(e.examStyle ? { examStyle: true } : {}),
      })
    }
  }

  /* ------------------------------ Klausuren ------------------------------ */
  const examFiles = (await fs.readdir(path.join(SRC, 'exams'))).filter((f) => f.endsWith('.json')).sort()
  const exams = []
  for (const f of examFiles) {
    const raw = await readJson(path.join(SRC, 'exams', f))
    const list = Array.isArray(raw) ? raw : [raw]
    for (const exam of list) {
      if (!exam?.id) {
        warn(`${f}: Klausur ohne id`)
        continue
      }
      /* Baupläne gegen die Aufgabenbank prüfen: liefert jeder genug Aufgaben? */
      for (const task of exam.tasks ?? []) {
        const bp = task.blueprint
        if (!bp) continue
        const types = bp.type ? (Array.isArray(bp.type) ? bp.type : [bp.type]) : null
        const available = items.filter(
          (m) =>
            bp.topicIds.includes(m.topicId) &&
            (!types || types.includes(m.type)) &&
            (!bp.minDifficulty || m.difficulty >= bp.minDifficulty) &&
            (!bp.maxDifficulty || m.difficulty <= bp.maxDifficulty),
        ).length
        if (available < bp.count) {
          warn(`${exam.id}/${task.id}: Bauplan verlangt ${bp.count} Aufgaben, verfügbar sind nur ${available}`)
        } else if (available < bp.count * 2) {
          warn(`${exam.id}/${task.id}: nur ${available} Aufgaben für ${bp.count} Plätze — Varianten wiederholen sich schnell`)
        }
      }

      /* Punkte gegenprüfen */
      const sum = (exam.tasks ?? []).reduce((s, t) => s + (Number(t.points) || 0), 0)
      const withBonus = (exam.totalPoints ?? 0) + (exam.bonusPoints ?? 0)
      if (exam.totalPoints && Math.abs(sum - exam.totalPoints) > 0.01 && Math.abs(sum - withBonus) > 0.01) {
        warn(`${exam.id}: Aufgabenpunkte (${sum}) weichen von totalPoints (${exam.totalPoints}) ab`)
      }
      await fs.writeFile(path.join(OUT, 'exams', `${exam.id}.json`), JSON.stringify(exam))
      exams.push({
        id: exam.id,
        lang: exam.lang,
        title: exam.title,
        subtitle: exam.subtitle,
        minutes: exam.minutes,
        totalPoints: exam.totalPoints,
        bonusPoints: exam.bonusPoints,
        origin: exam.origin,
        taskCount: (exam.tasks ?? []).length,
        note: exam.note,
      })
    }
  }

  /* ------------------------------- Theorie ------------------------------- */
  const theoryFiles = (await fs.readdir(path.join(SRC, 'theory'))).filter((f) => f.endsWith('.md')).sort()
  const theory = []
  for (const f of theoryFiles) {
    const id = f.replace(/\.md$/, '')
    if (!topicIds.has(id)) warn(`Theoriedatei ${f} gehört zu keinem Thema`)
    const text = await fs.readFile(path.join(SRC, 'theory', f), 'utf8')
    await fs.writeFile(path.join(OUT, 'theory', f), text)
    theory.push(id)
  }
  for (const id of topicIds) {
    if (!theory.includes(id)) warn(`Thema «${id}» hat keinen Theorietext`)
  }

  /* Kurzer Inhalts-Hash: ändert sich der Content, ändern sich auch die
     URLs der Detaildateien — damit kann kein Browser alte Aufgaben zeigen. */
  const build = createHash('sha1')
    .update(JSON.stringify(items) + JSON.stringify(exams) + theory.join(','))
    .digest('hex')
    .slice(0, 10)

  const index = {
    version: 3,
    build,
    generatedAt: new Date().toISOString().slice(0, 10),
    total,
    byLang: {
      python: items.filter((i) => i.lang === 'python').length,
      java: items.filter((i) => i.lang === 'java').length,
    },
    examStyle: items.filter((i) => i.examStyle).length,
    items,
    exams,
    theory,
  }
  await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify(index))

  const size = (await fs.readFile(path.join(OUT, 'index.json'))).length
  console.log(
    `Content: ${total} Aufgaben in ${byTopic.size} Themen, ${exams.length} Klausuren, ${theory.length} Theorietexte ` +
      `(Index ${(size / 1024).toFixed(0)} KB)`,
  )
  if (problems.length) {
    console.log(`\n${problems.length} Hinweise:`)
    for (const p of problems.slice(0, 40)) console.log('  • ' + p)
    if (problems.length > 40) console.log(`  … und ${problems.length - 40} weitere`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
