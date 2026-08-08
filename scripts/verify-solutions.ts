/* Prüft, ob die Musterlösungen der Java-Aufgaben im eingebauten Compiler
   genau die hinterlegte Ausgabe erzeugen.  npm run verify:java */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { runJava } from '../src/lib/java/index'

const DIR = join(process.cwd(), 'content', 'exercises')

interface Ex {
  id: string
  lang: string
  type: string
  solution: string
  code?: string
  expectedOutput?: string
  stdin?: string
}

const norm = (s: string) =>
  s.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')

let checked = 0
let ok = 0
const fails: string[] = []

for (const f of readdirSync(DIR).filter((x) => x.startsWith('java-') && x.endsWith('.json'))) {
  const raw = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Ex[] | { exercises: Ex[] }
  const list = Array.isArray(raw) ? raw : raw.exercises
  for (const ex of list) {
    if (ex.lang !== 'java' || !ex.expectedOutput) continue
    /* «Ausgabe vorhersagen» prüft den gezeigten Code, Programmieraufgaben die Musterlösung.
       Fehlersuche- und Lückenaufgaben enthalten absichtlich nicht lauffähigen Code. */
    if (ex.type === 'find-errors' || ex.type === 'fill-gaps') continue
    const source = ex.type === 'predict-output' ? ex.code : ex.solution
    if (!source || !/class\s+\w/.test(source)) continue
    checked++
    const r = runJava(source, { stdin: ex.stdin ?? '', maxMillis: 3000, allowSnippet: false })
    if (norm(r.stdout) === norm(ex.expectedOutput)) ok++
    else {
      fails.push(
        `✗ ${ex.id} (${ex.type})\n  erwartet: ${JSON.stringify(norm(ex.expectedOutput).slice(0, 220))}\n` +
          `  Compiler: ${JSON.stringify(norm(r.stdout).slice(0, 220))}` +
          (r.stderr ? `\n  stderr  : ${r.stderr.trim().slice(0, 220)}` : ''),
      )
    }
  }
}

console.log(`Java-Musterlösungen: ${ok}/${checked} erzeugen exakt die hinterlegte Ausgabe`)
if (fails.length) console.log('\n' + fails.join('\n\n'))
