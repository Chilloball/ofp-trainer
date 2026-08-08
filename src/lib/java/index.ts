import { JavaSyntaxError } from './lexer'
import { Parser, parseJava } from './parser'
import { Interpreter, type RunOptions } from './interpreter'
import { JavaRuntimeError, describeKind, type Val } from './values'

/* ==================================================================== *
 *  Öffentliche Schnittstelle des Java-Compilers
 *
 *  compile()  → Syntaxprüfung  (entspricht javac)
 *  run()      → Ausführung     (entspricht java)
 * ==================================================================== */

export interface JavaDiagnostic {
  line: number
  col: number
  message: string
  /** Zeile aus dem Quelltext, für die Anzeige mit Zeiger */
  source?: string
}

export interface JavaResult {
  ok: boolean
  compiled: boolean
  stdout: string
  stderr: string
  diagnostics: JavaDiagnostic[]
  exception?: { type: string; message: string; line?: number }
  durationMs: number
  timedOut: boolean
  /** true, wenn der Quelltext automatisch in eine Klasse verpackt wurde */
  wrapped: boolean
}

const CLASS_AT_TOP = /(^|\n)\s*(public\s+|final\s+|abstract\s+)*(class|interface|enum|record)\s+[A-Za-z_$]/

/** Erlaubt es, im Übungsmodus einzelne Anweisungen ohne Klassenrumpf zu schreiben. */
function wrapSnippet(src: string): { source: string; wrapped: boolean; offset: number } {
  if (CLASS_AT_TOP.test(src)) return { source: src, wrapped: false, offset: 0 }
  const header = 'public class Main {\n    public static void main(String[] args) {\n'
  const footer = '\n    }\n}\n'
  return { source: header + src + footer, wrapped: true, offset: 2 }
}

export function runJava(source: string, options: RunOptions & { allowSnippet?: boolean } = {}): JavaResult {
  const started = Date.now()
  const { source: src, wrapped, offset } = options.allowSnippet === false
    ? { source, wrapped: false, offset: 0 }
    : wrapSnippet(source)

  let unit
  try {
    unit = parseJava(src)
  } catch (e) {
    if (e instanceof JavaSyntaxError) {
      const line = Math.max(1, e.line - offset)
      return {
        ok: false,
        compiled: false,
        stdout: '',
        stderr: `Fehler beim Kompilieren:\nZeile ${line}: ${e.message}\n`,
        diagnostics: [{ line, col: e.col, message: e.message, source: sourceLine(source, line) }],
        durationMs: Date.now() - started,
        timedOut: false,
        wrapped,
      }
    }
    throw e
  }

  const interp = new Interpreter(unit, options)
  const result = interp.run()

  const diagnostics: JavaDiagnostic[] = []
  if (result.exception && result.exception.line) {
    const line = Math.max(1, result.exception.line - offset)
    diagnostics.push({
      line,
      col: 1,
      message: `${humanType(result.exception.type)}${result.exception.message ? ': ' + result.exception.message : ''}`,
      source: sourceLine(source, line),
    })
  }

  return {
    ok: result.exitCode === 0 && !result.exception,
    compiled: true,
    stdout: result.stdout,
    stderr: fixLines(result.stderr, offset),
    diagnostics,
    exception: result.exception,
    durationMs: Date.now() - started,
    timedOut: result.timedOut,
    wrapped,
  }
}

/** Nur Syntax prüfen — schnelle Rückmeldung beim Tippen. */
export function checkJava(source: string): JavaDiagnostic[] {
  const { source: src, offset } = wrapSnippet(source)
  try {
    parseJava(src)
    return []
  } catch (e) {
    if (e instanceof JavaSyntaxError) {
      const line = Math.max(1, e.line - offset)
      return [{ line, col: e.col, message: e.message, source: sourceLine(source, line) }]
    }
    return [{ line: 1, col: 1, message: (e as Error).message }]
  }
}

/* ------------------------- Tests für Aufgaben ------------------------- */

export interface JavaTest {
  name: string
  /** Java-Ausdruck, z. B. `Rechner.summe(3, 4)` */
  call: string
  /** erwarteter Wert als Java-Ausdruck, z. B. `7` */
  expected: string
}

export interface JavaTestResult {
  name: string
  passed: boolean
  got?: string
  expected?: string
  error?: string
}

export function runJavaTests(
  source: string,
  tests: JavaTest[],
  options: RunOptions & { runMain?: boolean } = {},
): { results: JavaTestResult[]; stdout: string; error?: string; diagnostics: JavaDiagnostic[] } {
  const { source: src, offset } = wrapSnippet(source)
  let unit
  try {
    unit = parseJava(src)
  } catch (e) {
    if (e instanceof JavaSyntaxError) {
      const line = Math.max(1, e.line - offset)
      return {
        results: tests.map((t) => ({ name: t.name, passed: false, error: 'Der Code lässt sich nicht kompilieren.' })),
        stdout: '',
        error: `Zeile ${line}: ${e.message}`,
        diagnostics: [{ line, col: e.col, message: e.message, source: sourceLine(source, line) }],
      }
    }
    throw e
  }

  const interp = new Interpreter(unit, options)
  let stdout = ''
  try {
    interp.prepare()
    if (options.runMain) {
      const r = interp.run()
      stdout = r.stdout
    }
  } catch (e) {
    return {
      results: tests.map((t) => ({ name: t.name, passed: false, error: msgOf(e) })),
      stdout,
      error: msgOf(e),
      diagnostics: [],
    }
  }

  const parseExpr = (s: string) => new Parser(s).parseExpr()
  const results: JavaTestResult[] = tests.map((t) => {
    try {
      const got = interp.evalExpressionSource(t.call, parseExpr)
      const exp = interp.evalExpressionSource(t.expected, parseExpr)
      const gotS = show(interp, got)
      const expS = show(interp, exp)
      return { name: t.name, passed: gotS === expS, got: gotS, expected: expS }
    } catch (e) {
      return { name: t.name, passed: false, error: msgOf(e) }
    }
  })

  return { results, stdout, diagnostics: [] }
}

function show(interp: Interpreter, v: Val): string {
  if (v.k === 'arr') return `[${v.v.map((x) => show(interp, x)).join(', ')}]`
  if (v.k === 'str') return JSON.stringify(v.v)
  return interp.str(v)
}

function msgOf(e: unknown): string {
  if (e instanceof JavaRuntimeError) return `${humanType(e.javaType)}${e.detail ? ': ' + e.detail : ''}`
  if (e instanceof JavaSyntaxError) return `Zeile ${e.line}: ${e.message}`
  return (e as Error)?.message ?? String(e)
}

function sourceLine(src: string, line: number): string | undefined {
  return src.split('\n')[line - 1]
}

function fixLines(text: string, offset: number): string {
  if (!offset) return text
  return text.replace(/Zeile (\d+)/g, (_, n) => `Zeile ${Math.max(1, Number(n) - offset)}`)
}

/** Deutsche Klartextnamen für die häufigsten Ausnahmen. */
export function humanType(type: string): string {
  const map: Record<string, string> = {
    ArithmeticException: 'ArithmeticException (Rechenfehler, z. B. Division durch 0)',
    NullPointerException: 'NullPointerException (Zugriff auf eine Referenz, die null ist)',
    ArrayIndexOutOfBoundsException: 'ArrayIndexOutOfBoundsException (Index außerhalb des Arrays)',
    StringIndexOutOfBoundsException: 'StringIndexOutOfBoundsException (Index außerhalb der Zeichenkette)',
    IndexOutOfBoundsException: 'IndexOutOfBoundsException (Index außerhalb des gültigen Bereichs)',
    NumberFormatException: 'NumberFormatException (Text lässt sich nicht in eine Zahl umwandeln)',
    ClassCastException: 'ClassCastException (unzulässige Typumwandlung)',
    StackOverflowError: 'StackOverflowError (Rekursion ohne Abbruch)',
    InputMismatchException: 'InputMismatchException (Eingabe passt nicht zum erwarteten Typ)',
    NoSuchElementException: 'NoSuchElementException (keine weitere Eingabe vorhanden)',
    CannotFindSymbol: 'Symbol nicht gefunden',
    NoSuchMethod: 'Methode nicht gefunden',
    NoSuchField: 'Feld nicht gefunden',
    IncompatibleTypes: 'Typfehler',
    NonStaticFromStatic: 'Nicht-statischer Zugriff aus statischem Kontext',
    NoMainMethod: 'Keine main-Methode',
    UnsupportedLibrary: 'Nicht unterstützter Teil der Java-Bibliothek',
  }
  return map[type] ?? type
}

export { describeKind }
export type { RunOptions }
