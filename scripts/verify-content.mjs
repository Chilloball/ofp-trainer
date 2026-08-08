#!/usr/bin/env node
/**
 * Inhaltliche Qualitätssicherung der Aufgabenbank.
 *
 *  • prüft Schema, IDs, Themenzuordnung, Punkte, Schwierigkeiten
 *  • führt JEDE Python-Musterlösung gegen ihre Tests aus
 *  • kompiliert und startet JEDE Java-Musterlösung (falls ein JDK vorhanden ist)
 *  • prüft predict-output-Aufgaben, indem der gezeigte Code wirklich läuft
 *  • prüft forbidden/required gegen die eigene Musterlösung
 *  • meldet Duplikate und fehlende Erklärungen
 *
 *   node scripts/verify-content.mjs            # alles
 *   node scripts/verify-content.mjs --quick    # ohne Ausführung
 *   node scripts/verify-content.mjs py-recursion
 */

import { readdir, readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EX_DIR = path.join(ROOT, 'content', 'exercises')
const EXAM_DIR = path.join(ROOT, 'content', 'exams')

const args = process.argv.slice(2)
const QUICK = args.includes('--quick')
const FILTER = args.find((a) => !a.startsWith('--'))

const VALID_TYPES = new Set([
  'code', 'predict-output', 'fill-gaps', 'mc', 'multi-mc', 'short-answer', 'find-errors', 'uml',
])

const TOPIC_IDS = new Set(
  (await readFile(path.join(ROOT, 'content', 'topics.ts'), 'utf8'))
    .match(/^\s*id: '([a-z0-9-]+)',$/gm)
    ?.map((l) => l.match(/'([a-z0-9-]+)'/)[1]) ?? [],
)

const problems = []
const warnings = []
let checked = 0
let executed = 0

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: opts.cwd, env: { ...process.env, JAVA_TOOL_OPTIONS: '' } })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeout ?? 15000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, out, err: err + ' (spawn error)' }) })
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }) })
    if (opts.input !== undefined) child.stdin.write(opts.input)
    child.stdin.end()
  })
}

let hasJava = false
if (!QUICK) {
  const r = await run('javac', ['-version'])
  hasJava = r.code === 0
  if (!hasJava) warnings.push('Kein JDK gefunden — Java-Aufgaben werden nur strukturell geprüft.')
}

function norm(s) {
  return String(s).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '').trim()
}

async function checkPython(ex) {
  const tests = ex.tests ?? []
  if (ex.type === 'code' && tests.length) {
    const checksArr = tests.map(
      (t, i) =>
        `__got = ${t.call}\n__exp = ${t.expected}\nassert __got == __exp, ${JSON.stringify(`Test ${i + 1} (${t.name}): `)} + repr(__got) + ' != ' + repr(__exp)`,
    )
    const code = ex.solution + '\n\n' + checksArr.join('\n')
    const r = await run('python3', ['-c', code], { timeout: 15000 })
    executed++
    if (r.code !== 0) problems.push(`${ex.id}: Musterlösung besteht die eigenen Tests nicht\n      ${r.err.trim().split('\n').slice(-2).join(' | ')}`)
  } else if (ex.type === 'predict-output' && ex.code) {
    const r = await run('python3', ['-c', ex.code], { timeout: 15000 })
    executed++
    const expected = norm(ex.expectedOutput ?? '')
    if (r.code === 0) {
      if (norm(r.out) !== expected) {
        problems.push(`${ex.id}: erwartete Ausgabe stimmt nicht\n      tatsächlich: ${JSON.stringify(norm(r.out))}\n      hinterlegt:  ${JSON.stringify(expected)}`)
      }
    } else {
      const errType = (r.err.trim().split('\n').pop() ?? '').split(':')[0].trim()
      if (!expected.includes(errType) && errType) {
        problems.push(`${ex.id}: Code wirft ${errType}, erwartete Ausgabe nennt das nicht (${JSON.stringify(expected).slice(0, 80)})`)
      }
    }
  } else if (ex.type === 'code' && ex.expectedOutput) {
    const r = await run('python3', ['-c', ex.solution], { timeout: 15000 })
    executed++
    if (r.code !== 0) problems.push(`${ex.id}: Musterlösung läuft nicht (${r.err.trim().split('\n').pop()})`)
    else if (norm(r.out) !== norm(ex.expectedOutput)) problems.push(`${ex.id}: Ausgabe der Musterlösung weicht ab`)
  }
}

function mainClassOf(src) {
  const mainIdx = src.search(/public\s+static\s+void\s+main\s*\(/)
  let best = null
  for (const m of src.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) {
    if (mainIdx < 0 || m.index < mainIdx) best = m[1]
  }
  return best ?? 'Main'
}

/** Holt den Java-Quelltext aus einer Musterlösung, auch wenn sie in Markdown eingebettet ist. */
function javaSourceOf(solution) {
  const fenced = [...solution.matchAll(/```(?:java)?\n([\s\S]*?)```/g)].map((m) => m[1])
  const candidate = fenced.find((c) => /class\s+[A-Za-z_$]/.test(c)) ?? (fenced.length ? null : solution)
  if (!candidate) return null
  // Prosa mit Backticks außerhalb von Fences ist kein Quelltext
  if (candidate.includes('`')) return null
  return /class\s+[A-Za-z_$]/.test(candidate) ? candidate : null
}

/* Nur diese Typen enthalten überhaupt kompilierbaren Quelltext. */
const JAVA_RUNNABLE = new Set(['code', 'fill-gaps', 'predict-output'])

async function checkJava(ex) {
  if (!hasJava) return
  if (!JAVA_RUNNABLE.has(ex.type)) return
  const src = javaSourceOf(ex.solution)
  if (!src) return
  const cls = mainClassOf(src)
  if (/[äöüÄÖÜß]/.test(cls)) { problems.push(`${ex.id}: Klassenname enthält Umlaute (${cls})`); return }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ofpv-'))
  try {
    await writeFile(path.join(dir, cls + '.java'), src, 'utf8')
    const c = await run('javac', ['-encoding', 'UTF-8', '-nowarn', cls + '.java'], { cwd: dir, timeout: 25000 })
    executed++
    if (c.code !== 0) {
      problems.push(`${ex.id}: Java-Musterlösung kompiliert nicht\n      ${c.err.split('\n').filter((l) => l.includes('error')).slice(0, 2).join(' | ')}`)
      return
    }
    if (!/public\s+static\s+void\s+main/.test(src)) return
    const needsInput = /new\s+Scanner\s*\(/.test(src)
    if (needsInput && ex.stdin === undefined) {
      // Programm wartet auf Eingaben, die die Aufgabe nicht mitliefert → Ausgabe nicht vergleichbar
      warnings.push(`${ex.id}: nutzt Scanner ohne hinterlegtes \`stdin\` — Ausgabe wurde nicht geprüft`)
      return
    }
    const r = await run('java', ['-cp', '.', cls], { cwd: dir, timeout: 15000, input: ex.stdin ?? '' })
    if (ex.expectedOutput !== undefined) {
      if (norm(r.out) !== norm(ex.expectedOutput)) {
        problems.push(`${ex.id}: Java-Ausgabe weicht ab\n      tatsächlich: ${JSON.stringify(norm(r.out)).slice(0, 160)}\n      hinterlegt:  ${JSON.stringify(norm(ex.expectedOutput)).slice(0, 160)}`)
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function checkSchema(ex, seen) {
  const id = ex.id ?? '(ohne id)'
  const need = (cond, msg) => { if (!cond) problems.push(`${id}: ${msg}`) }

  need(typeof ex.id === 'string' && ex.id.length > 3, 'id fehlt oder zu kurz')
  need(!seen.has(ex.id), 'doppelte id')
  seen.add(ex.id)
  need(ex.lang === 'python' || ex.lang === 'java', `lang ungültig (${ex.lang})`)
  need(TOPIC_IDS.size === 0 || TOPIC_IDS.has(ex.topicId), `topicId unbekannt (${ex.topicId})`)
  need(VALID_TYPES.has(ex.type), `type ungültig (${ex.type})`)
  need(Number.isInteger(ex.difficulty) && ex.difficulty >= 1 && ex.difficulty <= 5, `difficulty ungültig (${ex.difficulty})`)
  need(typeof ex.points === 'number' && ex.points > 0, 'points fehlt')
  need(typeof ex.title === 'string' && ex.title.length > 3, 'title fehlt')
  need(typeof ex.prompt === 'string' && ex.prompt.length > 10, 'prompt zu kurz')
  // Bei MC reicht der Buchstabe der richtigen Option — die Begründungen stehen in choices[].why
  const minSolution = ex.type === 'mc' || ex.type === 'multi-mc' ? 1 : 2
  need(typeof ex.solution === 'string' && ex.solution.trim().length >= minSolution, 'solution fehlt')
  need(typeof ex.explanation === 'string' && ex.explanation.length > 40, 'explanation fehlt oder zu kurz')

  if (ex.type === 'mc') {
    const c = ex.choices ?? []
    need(c.length >= 2, 'mc braucht mindestens 2 Optionen')
    need(c.filter((x) => x.correct).length === 1, 'mc braucht genau eine richtige Option')
  }
  if (ex.type === 'multi-mc') {
    need((ex.choices ?? []).filter((x) => x.correct).length >= 1, 'multi-mc braucht mindestens eine richtige Option')
  }
  if (ex.type === 'fill-gaps') {
    const g = ex.gaps ?? []
    need(g.length >= 1, 'fill-gaps braucht gaps')
    for (const gap of g) need(Array.isArray(gap.accept) && gap.accept.length >= 1, `Lücke ${gap.id} ohne accept`)
    if (ex.code) {
      for (const gap of g) {
        if (!new RegExp(`\\b${gap.id}\\b`).test(ex.code)) {
          warnings.push(`${id}: Lücke ${gap.id} taucht im Code nicht auf`)
        }
      }
    }
  }
  if (ex.type === 'predict-output') need(typeof ex.expectedOutput === 'string', 'predict-output braucht expectedOutput')
  if (ex.type === 'find-errors') need((ex.errors ?? []).length >= 1, 'find-errors braucht errors')
  if (ex.type === 'code' && ex.lang === 'python') {
    need((ex.tests ?? []).length >= 1 || typeof ex.expectedOutput === 'string', 'Python-Code-Aufgabe braucht tests oder expectedOutput')
  }

  for (const f of ex.forbidden ?? []) {
    if (ex.solution.includes(f)) problems.push(`${id}: verbotener Ausdruck ${JSON.stringify(f)} steht in der eigenen Musterlösung`)
  }
  for (const r of ex.required ?? []) {
    if (!ex.solution.includes(r)) problems.push(`${id}: geforderter Ausdruck ${JSON.stringify(r)} fehlt in der eigenen Musterlösung`)
  }
  if (!(ex.hints ?? []).length) warnings.push(`${id}: keine Hints`)
  if (!(ex.sources ?? []).length) warnings.push(`${id}: keine Quellenangabe`)
}

/* ------------------------------- Lauf ------------------------------- */

const files = existsSync(EX_DIR) ? (await readdir(EX_DIR)).filter((f) => f.endsWith('.json')) : []
const seen = new Set()
const all = []

for (const f of files.sort()) {
  if (FILTER && !f.includes(FILTER)) continue
  let data
  try {
    data = JSON.parse(await readFile(path.join(EX_DIR, f), 'utf8'))
  } catch (e) {
    problems.push(`${f}: kein gültiges JSON — ${e.message}`)
    continue
  }
  const list = Array.isArray(data) ? data : (data.exercises ?? [])
  for (const ex of list) {
    checked++
    checkSchema(ex, seen)
    all.push(ex)
  }
}

// Klausuren mitprüfen
if (existsSync(EXAM_DIR) && !FILTER) {
  for (const f of (await readdir(EXAM_DIR)).filter((x) => x.endsWith('.json'))) {
    let exam
    try {
      exam = JSON.parse(await readFile(path.join(EXAM_DIR, f), 'utf8'))
    } catch (e) {
      problems.push(`${f}: kein gültiges JSON — ${e.message}`)
      continue
    }
    const sum = exam.tasks.reduce((s, t) => s + (t.points ?? 0), 0)
    const expected = exam.totalPoints + (exam.bonusPoints ?? 0)
    if (sum !== expected) {
      warnings.push(`${exam.id}: Summe der Aufgabenpunkte (${sum}) ≠ totalPoints+Bonus (${expected})`)
    }
    for (const t of exam.tasks) {
      for (const ex of t.inline ?? []) {
        checked++
        checkSchema(ex, seen)
        all.push(ex)
      }
      const inlineSum = (t.inline ?? []).reduce((s, e) => s + e.points, 0)
      if (t.inline?.length && inlineSum !== t.points) {
        warnings.push(`${exam.id}/${t.id}: Punkte der Einzelaufgaben (${inlineSum}) ≠ Aufgabenpunkte (${t.points})`)
      }
    }
  }
}

if (!QUICK) {
  const CONCURRENCY = 6
  let i = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < all.length) {
      const ex = all[i++]
      try {
        if (ex.lang === 'python') await checkPython(ex)
        else await checkJava(ex)
      } catch (e) {
        problems.push(`${ex.id}: Prüfung abgebrochen — ${e.message}`)
      }
    }
  })
  await Promise.all(workers)
}

/* ------------------------------ Bericht ------------------------------ */

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m'

console.log(`\n${D}────────────────────────────────────────────${X}`)
console.log(`  ${checked} Aufgaben geprüft, ${executed} davon ausgeführt`)
console.log(`${D}────────────────────────────────────────────${X}\n`)

if (problems.length) {
  console.log(`${R}✖ ${problems.length} Fehler${X}\n`)
  for (const p of problems) console.log(`  ${R}•${X} ${p}`)
  console.log()
}
if (warnings.length) {
  console.log(`${Y}⚠ ${warnings.length} Hinweise${X}`)
  for (const w of warnings.slice(0, 40)) console.log(`  ${Y}•${X} ${w}`)
  if (warnings.length > 40) console.log(`  ${D}… und ${warnings.length - 40} weitere${X}`)
  console.log()
}
if (!problems.length) console.log(`${G}✔ Alle Aufgaben sind schlüssig.${X}\n`)

process.exit(problems.length ? 1 : 0)
