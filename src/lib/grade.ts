import type { Exercise } from './types'

/* ==================================================================== *
 *  Bewertung von Antworten
 *
 *  Alles, was ohne Code-Ausführung entschieden werden kann, wird hier
 *  bewertet (Client wie Server nutzen dieselbe Funktion → konsistent).
 *  Code-Aufgaben werden zusätzlich ausgeführt (Pyodide bzw. JDK).
 * ==================================================================== */

/** Whitespace/Anführungszeichen normalisieren, damit Tippstil nicht bestraft wird. */
export function norm(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[""„“]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim()
}

/** Für Ausgaben: zusätzlich Groß-/Kleinschreibung beibehalten, aber Leerzeilen am Ende killen. */
export function normOutput(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim()
}

/** Für Code-Fragmente in Lücken: Leerzeichen komplett egal. */
export function normGap(s: string): string {
  return norm(s)
    .replace(/\s*([(),:\[\]{}+\-*/%<>=!])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/;$/, '')
    .trim()
}

/** Levenshtein-Distanz (für "fast richtig"-Feedback). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array(n + 1)
  let cur = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

export interface GradeResult {
  /** 0..1 */
  score: number
  correct: boolean
  /** pro Teilaufgabe: richtig/falsch */
  parts?: { id: string | number; correct: boolean; expected?: string; got?: string; note?: string }[]
  feedback: string
  /** true, wenn nur eine Kleinigkeit fehlt */
  nearMiss?: boolean
  /** muss der Nutzer selbst bewerten? */
  needsSelfCheck?: boolean
}

export function gradeAnswer(ex: Exercise, answer: unknown): GradeResult {
  switch (ex.type) {
    case 'mc':
    case 'multi-mc':
      return gradeChoice(ex, answer)
    case 'fill-gaps':
      return gradeGaps(ex, answer)
    case 'predict-output':
      return gradeOutput(ex, answer)
    case 'find-errors':
      return gradeErrors(ex, answer)
    case 'short-answer':
    case 'uml':
      return {
        score: 0,
        correct: false,
        needsSelfCheck: true,
        feedback: 'Vergleiche deine Antwort mit der Musterlösung und bewerte dich ehrlich selbst.',
      }
    case 'code':
      // Wird durch den Runner bewertet; hier nur statische Regeln prüfen.
      return gradeCodeStatic(ex, String(answer ?? ''))
    default:
      return { score: 0, correct: false, needsSelfCheck: true, feedback: 'Unbekannter Aufgabentyp.' }
  }
}

function gradeChoice(ex: Exercise, answer: unknown): GradeResult {
  const choices = ex.choices ?? []
  const picked = new Set<string>(Array.isArray(answer) ? (answer as string[]) : answer ? [String(answer)] : [])
  const correct = new Set(choices.filter((c) => c.correct).map((c) => c.id))

  if (ex.type === 'mc') {
    const one = [...picked][0]
    const ok = !!one && correct.has(one)
    return {
      score: ok ? 1 : 0,
      correct: ok,
      parts: choices.map((c) => ({
        id: c.id,
        correct: c.correct,
        note: c.why,
      })),
      feedback: ok ? 'Richtig.' : 'Leider falsch — schau dir die Begründungen an.',
    }
  }

  // multi-mc: partielle Punkte, aber falsche Kreuze ziehen ab
  let hits = 0
  let wrong = 0
  for (const c of choices) {
    if (picked.has(c.id) && c.correct) hits++
    if (picked.has(c.id) && !c.correct) wrong++
  }
  const raw = correct.size > 0 ? Math.max(0, (hits - wrong) / correct.size) : 0
  return {
    score: Math.max(0, Math.min(1, raw)),
    correct: raw >= 0.999,
    parts: choices.map((c) => ({ id: c.id, correct: c.correct, note: c.why })),
    feedback:
      raw >= 0.999
        ? 'Alles richtig angekreuzt.'
        : `${hits} von ${correct.size} richtigen Antworten getroffen${wrong ? `, ${wrong} falsch angekreuzt` : ''}.`,
  }
}

function gradeGaps(ex: Exercise, answer: unknown): GradeResult {
  const gaps = ex.gaps ?? []
  const given = (answer ?? {}) as Record<string, string>
  const parts = gaps.map((g) => {
    const got = String(given[String(g.id)] ?? '')
    const gn = normGap(got)
    let ok = g.accept.some((a) => normGap(a) === gn)
    if (!ok && g.regex) {
      try {
        ok = new RegExp(g.regex).test(got.trim())
      } catch {
        /* ungültige Regex ignorieren */
      }
    }
    const best = g.accept[0] ?? ''
    const near = !ok && gn.length > 0 && levenshtein(gn, normGap(best)) <= Math.max(1, Math.floor(normGap(best).length * 0.18))
    return {
      id: g.id,
      correct: ok,
      expected: best,
      got,
      note: near ? 'Fast — achte auf Details (Schreibweise, Klammern).' : g.explanation,
    }
  })
  const hits = parts.filter((p) => p.correct).length
  const score = gaps.length ? hits / gaps.length : 0
  return {
    score,
    correct: score >= 0.999,
    parts,
    nearMiss: score < 1 && parts.some((p) => !p.correct && p.note?.startsWith('Fast')),
    feedback: `${hits} von ${gaps.length} Lücken richtig.`,
  }
}

function gradeOutput(ex: Exercise, answer: unknown): GradeResult {
  const expected = normOutput(ex.expectedOutput ?? '')
  const got = normOutput(String(answer ?? ''))
  if (!expected) return { score: 0, correct: false, needsSelfCheck: true, feedback: 'Keine Referenzausgabe hinterlegt.' }

  if (got === expected) return { score: 1, correct: true, feedback: 'Ausgabe exakt richtig.' }

  // Vergleich ohne Groß-/Kleinschreibung und Leerzeichen → "fast"
  const loose = (s: string) => s.replace(/\s+/g, '').toLowerCase()
  if (loose(got) === loose(expected)) {
    return {
      score: 0.7,
      correct: false,
      nearMiss: true,
      feedback: 'Inhaltlich richtig, aber Formatierung/Zeilenumbrüche weichen ab. In der Klausur zählt die exakte Ausgabe.',
    }
  }

  // zeilenweise Teilpunkte
  const el = expected.split('\n')
  const gl = got.split('\n')
  let same = 0
  for (let i = 0; i < Math.min(el.length, gl.length); i++) if (el[i] === gl[i]) same++
  const score = el.length ? Math.max(0, (same / el.length) * 0.6) : 0
  const d = levenshtein(loose(got), loose(expected))
  return {
    score,
    correct: false,
    nearMiss: d <= 2,
    feedback:
      same > 0
        ? `${same} von ${el.length} Zeilen stimmen. Ab Zeile ${same + 1} weicht die Ausgabe ab.`
        : 'Die Ausgabe stimmt nicht.',
  }
}

function gradeErrors(ex: Exercise, answer: unknown): GradeResult {
  const errors = ex.errors ?? []
  const text = norm(String(answer ?? '')).toLowerCase()
  if (!errors.length) return { score: 0, correct: false, needsSelfCheck: true, feedback: 'Keine Fehlerliste hinterlegt.' }
  // Heuristik: erkennt der Nutzer Schlüsselbegriffe der Fehler?
  const parts = errors.map((e, i) => {
    const keys = [e.wrong, e.fix]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9äöüß_.()]+/)
      .filter((w) => w.length >= 3)
    const hit = keys.filter((k) => text.includes(k)).length
    const ok = keys.length > 0 && hit / keys.length >= 0.45
    return { id: i + 1, correct: ok, expected: `${e.wrong} → ${e.fix}`, note: e.why }
  })
  const hits = parts.filter((p) => p.correct).length
  return {
    score: hits / errors.length,
    correct: hits === errors.length,
    parts,
    needsSelfCheck: hits < errors.length,
    feedback: `Automatische Einschätzung: ${hits} von ${errors.length} Fehlern benannt. Prüfe selbst nach.`,
  }
}

export function gradeCodeStatic(ex: Exercise, code: string): GradeResult {
  const problems: string[] = []
  for (const f of ex.forbidden ?? []) {
    if (code.includes(f)) problems.push(`\`${f.trim()}\` ist in dieser Aufgabe nicht erlaubt.`)
  }
  for (const r of ex.required ?? []) {
    if (!code.includes(r)) problems.push(`\`${r.trim()}\` muss vorkommen.`)
  }
  if (problems.length) {
    return { score: 0, correct: false, feedback: problems.join(' ') }
  }
  return { score: 1, correct: true, feedback: '' }
}

/** Vergleicht Regeln + Testergebnisse zu einer Gesamtnote. */
export function combineCodeResult(
  ex: Exercise,
  code: string,
  tests: { name: string; passed: boolean; got?: string; expected?: string; error?: string }[],
  runtimeError?: string,
): GradeResult {
  const staticCheck = gradeCodeStatic(ex, code)
  if (!staticCheck.correct) {
    return { ...staticCheck, parts: tests.map((t, i) => ({ id: i, correct: false, note: t.name })) }
  }
  if (runtimeError) {
    return {
      score: 0,
      correct: false,
      feedback: `Fehler beim Ausführen: ${runtimeError.split('\n').slice(-3).join(' ')}`,
      parts: tests.map((t, i) => ({ id: i, correct: false, note: t.name })),
    }
  }
  if (!tests.length) return { score: 0, correct: false, needsSelfCheck: true, feedback: 'Keine Tests vorhanden.' }
  const passed = tests.filter((t) => t.passed).length
  const score = passed / tests.length
  return {
    score,
    correct: score >= 0.999,
    parts: tests.map((t, i) => ({
      id: i,
      correct: t.passed,
      expected: t.expected,
      got: t.got,
      note: t.name + (t.error ? ` — ${t.error}` : ''),
    })),
    feedback: score >= 0.999 ? 'Alle Tests bestanden.' : `${passed} von ${tests.length} Tests bestanden.`,
  }
}
