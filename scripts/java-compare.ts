/* Vergleicht den eingebauten Interpreter mit einem echten JDK anhand der
   Beispieldateien aus dem Vorlesungs-Repository. Aufruf: npm run test:java:jdk */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { runJava } from '../src/lib/java/index'

const ROOT = process.argv[2] ?? join(process.cwd(), '..', 'ofp-2')
const STDIN = ''

function collect(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...collect(p))
    else if (entry.endsWith('.java')) out.push(p)
  }
  return out
}

const SKIP = /Socket|Thread|Server|Client|Serial|Datei|File|Random|Zufall|BDayParadox/i

let same = 0
let diff = 0
let skipped = 0
const problems: string[] = []

for (const file of collect(ROOT).sort()) {
  const src = readFileSync(file, 'utf8')
  const short = file.replace(ROOT + '/', '')
  const nondeterministic = /new\s+Random\s*\(\s*\)|Math\.random|currentTimeMillis|nanoTime/.test(src)
  if (SKIP.test(short) || nondeterministic) {
    skipped++
    continue
  }

  const tmp = mkdtempSync(join(os.tmpdir(), 'ofp-java-'))
  let real: string
  try {
    const cls = /(?:public\s+)?(?:final\s+|abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(src)?.[1]
    if (!cls) {
      skipped++
      continue
    }
    writeFileSync(join(tmp, `${cls}.java`), src)
    execFileSync('javac', ['-encoding', 'UTF-8', '-nowarn', `${cls}.java`], { cwd: tmp, stdio: 'pipe' })
    real = execFileSync('java', ['-cp', '.', cls], {
      cwd: tmp,
      input: STDIN,
      stdio: 'pipe',
      timeout: 8000,
    }).toString()
  } catch {
    skipped++
    rmSync(tmp, { recursive: true, force: true })
    continue
  }
  rmSync(tmp, { recursive: true, force: true })

  const mine = runJava(src, { stdin: STDIN, maxMillis: 4000, allowSnippet: false })
  const got = mine.stdout

  // Referenzen (Object@hash) und Zufallszahlen unterscheiden sich naturgemäß
  const normalize = (s: string) => s.replace(/@[0-9a-f]+/g, '@X').replace(/\r/g, '')
  if (normalize(got) === normalize(real)) same++
  else {
    diff++
    problems.push(
      `✗ ${short}\n  javac : ${JSON.stringify(real.slice(0, 300))}\n  eigen : ${JSON.stringify(got.slice(0, 300))}` +
        (mine.exception ? `\n  Fehler: ${mine.exception.type}: ${mine.exception.message}` : '') +
        (mine.stderr ? `\n  stderr: ${mine.stderr.slice(0, 300)}` : ''),
    )
  }
}

console.log(`Vergleich mit echtem JDK: ${same} identisch, ${diff} abweichend, ${skipped} übersprungen`)
if (problems.length) console.log('\n' + problems.join('\n\n'))
