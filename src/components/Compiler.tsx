'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { usePython } from '@/lib/usePython'
import { useJava } from '@/lib/useJava'
import { CodeEditor } from './CodeEditor'
import { Console } from './CodeBlock'
import { Segmented, Spinner } from './ui'
import { Page } from './Shell'

/* ==================================================================== *
 *  Der Compiler
 *
 *  Python läuft über CPython (WebAssembly), Java über den in dieser App
 *  enthaltenen Compiler. Beides ohne Installation, beides im Browser.
 * ==================================================================== */

const EXAMPLES: Record<'python' | 'java', { label: string; code: string; stdin?: string }[]> = {
  python: [
    {
      label: 'Erste Schritte',
      code: `name = input("Wie heisst du? ")
print("Hallo", name)
print("Dein Name hat", len(name), "Zeichen")
`,
      stdin: 'Welt\n',
    },
    {
      label: 'Rekursion',
      code: `def fak(n):
    if n <= 1:
        return 1
    return n * fak(n - 1)

for i in range(1, 11):
    print(i, "! =", fak(i))
`,
    },
    {
      label: 'map, filter, reduce',
      code: `from functools import reduce

zahlen = [3, 8, 1, 9, 4, 7]

quadrate = list(map(lambda x: x ** 2, zahlen))
gerade   = list(filter(lambda x: x % 2 == 0, zahlen))
summe    = reduce(lambda a, b: a + b, zahlen, 0)

print("Quadrate:", quadrate)
print("Gerade:  ", gerade)
print("Summe:   ", summe)
`,
    },
    {
      label: 'Scopes und Mutability',
      code: `def anhaengen(liste, wert):
    liste.append(wert)          # veraendert das uebergebene Objekt
    liste = [999]               # bindet nur den lokalen Namen neu
    return liste

original = [1, 2]
ergebnis = anhaengen(original, 3)

print("original:", original)
print("ergebnis:", ergebnis)
`,
    },
  ],
  java: [
    {
      label: 'Erste Schritte',
      code: `public class Main {
    public static void main(String[] args) {
        String name = "Welt";
        System.out.println("Hallo " + name);
        System.out.printf("%d Zeichen%n", name.length());
    }
}
`,
    },
    {
      label: 'Klasse mit Konstruktor',
      code: `public class Main {
    public static void main(String[] args) {
        Konto k = new Konto("Meier", 100.0);
        k.einzahlen(50.5);
        k.abheben(200.0);
        System.out.println(k);
    }
}

class Konto {
    private final String inhaber;
    private double stand;

    Konto(String inhaber, double start) {
        this.inhaber = inhaber;
        this.stand = start;
    }

    void einzahlen(double betrag) {
        if (betrag > 0) stand += betrag;
    }

    void abheben(double betrag) {
        if (betrag > stand) {
            System.out.println("Nicht gedeckt: es fehlen " + (betrag - stand));
            return;
        }
        stand -= betrag;
    }

    @Override
    public String toString() {
        return inhaber + ": " + stand;
    }
}
`,
    },
    {
      label: 'Vererbung und Polymorphie',
      code: `public class Main {
    public static void main(String[] args) {
        Figur[] figuren = { new Rechteck(3, 4), new Kreis(2) };
        double summe = 0;
        for (Figur f : figuren) {
            System.out.println(f.name() + ": " + f.flaeche());
            summe += f.flaeche();
        }
        System.out.println("Summe: " + summe);
    }
}

abstract class Figur {
    abstract double flaeche();
    String name() { return getClass().getSimpleName(); }
}

class Rechteck extends Figur {
    private final double a, b;
    Rechteck(double a, double b) { this.a = a; this.b = b; }
    double flaeche() { return a * b; }
}

class Kreis extends Figur {
    private final double r;
    Kreis(double r) { this.r = r; }
    double flaeche() { return Math.PI * r * r; }
}
`,
    },
    {
      label: 'Ausnahmebehandlung',
      code: `public class Main {
    public static void main(String[] args) {
        int[] werte = { 10, 0, 5 };
        for (int i = 0; i <= werte.length; i++) {
            try {
                System.out.println(100 / werte[i]);
            } catch (ArithmeticException e) {
                System.out.println("Division durch 0");
            } catch (ArrayIndexOutOfBoundsException e) {
                System.out.println("Index " + i + " gibt es nicht");
            } finally {
                System.out.println("  Durchlauf " + i + " beendet");
            }
        }
    }
}
`,
    },
    {
      label: 'Eingabe mit Scanner',
      code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Zahl: ");
        int n = sc.nextInt();
        System.out.println("Quadrat: " + n * n);
    }
}
`,
      stdin: '7\n',
    },
  ],
}

export function Compiler() {
  const { progress, setScratch, ready } = useStore()
  const [lang, setLang] = useState<'python' | 'java'>('java')
  const [code, setCode] = useState('')
  const [stdin, setStdin] = useState('')
  const [showStdin, setShowStdin] = useState(false)
  const [out, setOut] = useState<{ stdout: string; stderr?: string | null; ms?: number; note?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const python = usePython()
  const java = useJava()
  const loaded = useRef(false)

  /* gespeicherten Code übernehmen, sobald der Lernstand da ist */
  useEffect(() => {
    if (!ready || loaded.current) return
    loaded.current = true
    if (progress.scratch[lang]) setCode(progress.scratch[lang])
    else {
      setCode(EXAMPLES[lang][0].code)
      setStdin(EXAMPLES[lang][0].stdin ?? '')
    }
    /* Läuft bewusst nur einmal: danach gehört das Feld dem Nutzer, ein
       erneutes Überschreiben würde seine Eingabe verwerfen. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const switchLang = (next: 'python' | 'java') => {
    setScratch(lang, code)
    setLang(next)
    if (progress.scratch[next]) setCode(progress.scratch[next])
    else {
      setCode(EXAMPLES[next][0].code)
      setStdin(EXAMPLES[next][0].stdin ?? '')
    }
    setOut(null)
  }

  useEffect(() => {
    if (!ready || !loaded.current) return
    const t = setTimeout(() => setScratch(lang, code), 900)
    return () => clearTimeout(t)
  }, [code, lang, ready, setScratch])

  const run = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const t0 = performance.now()
    try {
      if (lang === 'python') {
        const r = await python.run(code, [], stdin)
        setOut({
          stdout: r.stdout,
          stderr: r.error ? (r.traceback || r.error) : null,
          ms: Math.round(performance.now() - t0),
          note: r.line ? `Fehler in Zeile ${r.line}.` : undefined,
        })
      } else {
        const r = await java.run(code, stdin)
        setOut({
          stdout: r.stdout,
          stderr: r.compiled
            ? r.stderr || null
            : r.diagnostics.map((d) => `Zeile ${d.line}: ${d.message}`).join('\n\n'),
          ms: r.durationMs,
          note: r.wrapped ? 'Der Code wurde automatisch in eine Klasse Main mit main-Methode verpackt.' : undefined,
        })
      }
    } finally {
      setBusy(false)
    }
  }, [busy, lang, code, stdin, python, java])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void run()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [run])

  const download = () => {
    const name = lang === 'python' ? 'programm.py' : (/class\s+(\w+)/.exec(code)?.[1] ?? 'Main') + '.java'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  return (
    <Page
      title="Compiler"
      lead={
        lang === 'java'
          ? 'Java wird hier vollständig im Browser übersetzt und ausgeführt — kein JDK nötig.'
          : 'Python läuft als echtes CPython über WebAssembly, direkt in diesem Tab.'
      }
      wide
      actions={
        <Segmented
          value={lang}
          onChange={switchLang}
          options={[
            { value: 'java', label: 'Java' },
            { value: 'python', label: 'Python' },
          ]}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button onClick={run} disabled={busy} className="btn-primary">
              {busy ? <Spinner /> : null}
              {busy ? (python.status === 'loading' ? 'Python startet …' : 'Läuft …') : 'Ausführen'}
            </button>
            <span className="text-[12.5px] text-faint">⌘/Strg + ⏎</span>

            <select
              className="field ml-auto !w-auto !py-1.5 !text-[13px]"
              value=""
              onChange={(e) => {
                const ex = EXAMPLES[lang].find((x) => x.label === e.target.value)
                if (ex) {
                  setCode(ex.code)
                  setStdin(ex.stdin ?? '')
                  if (ex.stdin) setShowStdin(true)
                  setOut(null)
                }
              }}
              aria-label="Beispiel laden"
            >
              <option value="">Beispiel laden …</option>
              {EXAMPLES[lang].map((ex) => (
                <option key={ex.label} value={ex.label}>
                  {ex.label}
                </option>
              ))}
            </select>
            <button onClick={download} className="btn-quiet btn-sm">
              Speichern
            </button>
          </div>

          <CodeEditor
            value={code}
            onChange={setCode}
            language={lang}
            minHeight="440px"
            maxHeight="70vh"
            onRun={run}
            placeholder={lang === 'java' ? 'public class Main { … }' : 'print("Hallo")'}
          />

          <div className="mt-3">
            <button
              onClick={() => setShowStdin((s) => !s)}
              className="text-[13px] text-muted hover:text-ink"
              aria-expanded={showStdin}
            >
              {showStdin ? '− ' : '+ '}
              Konsoleneingabe {lang === 'java' ? '(Scanner)' : '(input)'}
              {stdin ? ` — ${stdin.split('\n').filter(Boolean).length} Zeilen` : ''}
            </button>
            {showStdin && (
              <textarea
                className="field-mono mt-2"
                rows={3}
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder={'Eine Eingabe pro Zeile'}
                spellCheck={false}
              />
            )}
          </div>
        </div>

        <div>
          {out ? (
            <>
              <Console stdout={out.stdout} stderr={out.stderr} maxHeight={520} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-faint">
                {typeof out.ms === 'number' && <span className="tabnum">{out.ms} ms</span>}
                {out.note && <span>{out.note}</span>}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-line px-5 py-10 text-center">
              <p className="text-[14px] text-muted">Noch nichts ausgeführt.</p>
              <p className="mt-1 text-[13px] text-faint">
                Die Ausgabe erscheint hier — inklusive Compilerfehlern mit Zeilennummer.
              </p>
            </div>
          )}

          <div className="mt-5 rounded-md border border-line bg-sunken px-4 py-3.5">
            <div className="eyebrow">Gut zu wissen</div>
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              {lang === 'java' ? (
                <>
                  <li>Einzelne Anweisungen ohne Klasse werden automatisch in eine <code className="font-mono">main</code>-Methode verpackt.</li>
                  <li>Ganzzahlüberlauf, abschneidende Division und Referenzvergleiche verhalten sich wie in der JVM.</li>
                  <li>Dateien, Netzwerk und echte Nebenläufigkeit gibt es hier nicht; <code className="font-mono">start()</code> ruft <code className="font-mono">run()</code> direkt auf.</li>
                  <li>Endlosschleifen werden nach wenigen Sekunden abgebrochen.</li>
                </>
              ) : (
                <>
                  <li>Beim ersten Start lädt die Python-Laufzeit einmalig nach; danach geht es sofort.</li>
                  <li>Die Standardbibliothek ist vollständig verfügbar, ebenso <code className="font-mono">functools.reduce</code>.</li>
                  <li>Eingaben über <code className="font-mono">input()</code> kommen aus dem Feld links.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Page>
  )
}
