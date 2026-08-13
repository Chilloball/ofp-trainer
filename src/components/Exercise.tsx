'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Confidence, Exercise as Ex } from '@/lib/types'
import { combineCodeResult, gradeAnswer, gradeCodeStatic, normOutput, type GradeResult } from '@/lib/grade'
import { usePython } from '@/lib/usePython'
import { useJava } from '@/lib/useJava'
import { TOPIC_BY_ID } from '@/content/topics'
import { CodeBlock, Console } from './CodeBlock'
import { CodeEditor } from './CodeEditor'
import { Markdown } from './Markdown'
import { Mermaid } from './Mermaid'
import { AnimatedNumber, Disclosure, EASE, Spinner } from './ui'
import { OutputDiff } from './viz'
import { SourceList } from './Sources'
import { splitLead } from '@/lib/text'

const DIFF = ['', 'Aufwärmen', 'Leicht', 'Klausurniveau', 'Schwer', 'Härtetest']

/* Drei Stufen reichen. Bei fünf Stufen wählen Lernende fast nur noch
   die Mitte, und die Kalibrierung verliert ihre Aussagekraft. */
const CONFIDENCE = [
  { value: 0, label: 'Rate ich', hint: 'Ich habe keine belastbare Idee' },
  { value: 1, label: 'Denke schon', hint: 'Bin mir ziemlich sicher, aber nicht ganz' },
  { value: 2, label: 'Sicher', hint: 'Das kann ich' },
] as const

export interface ExerciseResult {
  score: number
  ms: number
  usedHints: number
  revealed: boolean
  /** Selbsteinschätzung vor dem Prüfen */
  confidence?: Confidence
}

/**
 * Wie viel Hilfe die Aufgabe von sich aus anbietet.
 *
 * Für Anfänger ist das Studieren einer fertigen Lösung nachweislich
 * effizienter als freies Herumprobieren — freies Problemlösen erzeugt
 * bei fehlendem Vorwissen vor allem Belastung, kein Wissen. Mit
 * wachsendem Können kehrt sich das um, deshalb wird die Hilfe
 * schrittweise entzogen (guidance fading):
 *
 *   beispiel  — Lösung und Erklärung stehen VOR dem Versuch
 *   gefuehrt  — der erste Tipp ist schon aufgeklappt
 *   frei      — nichts, wie in der Klausur
 */
export type Support = 'beispiel' | 'gefuehrt' | 'frei'

export function ExerciseView({
  exercise,
  onDone,
  onNext,
  onSkip,
  position,
  total,
  support = 'frei',
  examMode = false,
  onAnswerChange,
  flagged,
  onToggleFlag,
}: {
  exercise: Ex
  /** Wird EINMAL aufgerufen, wenn die Antwort endgültig bewertet ist. Bucht nur — blättert nicht weiter. */
  onDone: (r: ExerciseResult) => void
  /**
   * Weiterblättern. Bewusst getrennt von `onDone`: Wer nach dem Prüfen
   * sofort die nächste Aufgabe sieht, liest keine einzige Erklärung —
   * und genau die Erklärung ist der Teil, an dem gelernt wird.
   */
  onNext?: () => void
  onSkip?: () => void
  position?: number
  total?: number
  support?: Support
  /** Klausurmodus: keine Lösung, keine Tipps, keine Sofortbewertung */
  examMode?: boolean
  onAnswerChange?: (answer: unknown) => void
  flagged?: boolean
  onToggleFlag?: () => void
}) {
  const topic = TOPIC_BY_ID[exercise.topicId]
  const python = usePython()
  const java = useJava()

  const [answer, setAnswer] = useState<unknown>(() => initialAnswer(exercise))
  const [result, setResult] = useState<GradeResult | null>(null)
  const [hints, setHints] = useState(0)
  const [revealed, setRevealed] = useState(false)
  /* Selbsteinschätzung VOR dem Prüfen. Sie kostet zwei Sekunden und ist
     der Hebel für zwei Dinge: die Kalibrierung auf der Fortschrittsseite
     und die Hervorhebung hochsicherer Fehler (Hypercorrection). */
  const [confidence, setConfidence] = useState<Confidence | null>(null)
  /** true, sobald die Antwort gebucht ist — dann erscheint «Weiter». */
  const [recorded, setRecorded] = useState(false)
  const [busy, setBusy] = useState<'check' | 'run' | null>(null)
  const [output, setOutput] = useState<{ stdout: string; stderr?: string | null } | null>(null)
  /** kurzes visuelles Echo nach dem Prüfen */
  const [echo, setEcho] = useState<'ok' | 'bad' | null>(null)
  const started = useRef(Date.now())
  /* Eine Aufgabe darf genau einmal gewertet werden: Beim automatischen
     Abschluss bleibt der «Weiter»-Knopf während der Ausblendanimation
     noch klickbar — ohne diese Sperre zählte die Antwort doppelt. */
  const finished = useRef(false)

  const isCode = exercise.type === 'code'
  const runnable = isCode || (exercise.lang === 'java' && !!exercise.code)

  useEffect(() => {
    setAnswer(initialAnswer(exercise))
    setResult(null)
    setHints(support === 'gefuehrt' && exercise.hints?.length ? 1 : 0)
    setRevealed(false)
    setConfidence(null)
    setRecorded(false)
    setOutput(null)
    setEcho(null)
    started.current = Date.now()
    finished.current = false
    if (isCode) {
      if (exercise.lang === 'python') python.preload()
      else java.preload()
    }
    /* Nur bei einem echten Aufgabenwechsel zurücksetzen — nicht, wenn
       sich lediglich eine Rückruffunktion neu gebildet hat. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id])

  useEffect(() => {
    onAnswerChange?.(answer)
    /* Absichtlich nur an der Antwort hängend: die Meldefunktion wechselt
       bei jedem Tastendruck der Elternkomponente die Identität. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer])

  const finish = useCallback(
    (score: number) => {
      if (finished.current) return
      finished.current = true
      setRecorded(true)
      onDone({
        score,
        ms: Date.now() - started.current,
        /* Geführte Lösungen zählen wie genutzte Tipps: Wer die Lösung
           vorher gesehen hat, hat sie nicht abgerufen — die Aufgabe muss
           früher wiederkommen. */
        usedHints: hints + (support === 'beispiel' ? 2 : 0),
        revealed,
        confidence: confidence ?? undefined,
      })
    },
    [hints, onDone, revealed, confidence, support],
  )

  /* ------------------------------ Prüfen ------------------------------ */

  const check = useCallback(async () => {
    if (busy) return
    setBusy('check')
    try {
      let res: GradeResult

      if (isCode && exercise.lang === 'python') {
        const code = String(answer ?? '')
        const run = await python.run(code, exercise.tests ?? [], exercise.stdin ?? '')
        setOutput({ stdout: run.stdout, stderr: run.error })
        if (exercise.tests?.length) {
          res = combineCodeResult(exercise, code, run.tests, run.error ?? undefined)
        } else if (exercise.expectedOutput) {
          const rules = gradeCodeStatic(exercise, code)
          const ok = !run.error && normOutput(run.stdout) === normOutput(exercise.expectedOutput)
          res = rules.correct
            ? {
                score: ok ? 1 : 0,
                correct: ok,
                feedback: run.error
                  ? `Fehler beim Ausführen: ${run.error}`
                  : ok
                    ? 'Die Ausgabe stimmt exakt.'
                    : 'Die Ausgabe weicht noch ab — der Vergleich unten zeigt, wo.',
              }
            : rules
        } else {
          res = { score: 0, correct: false, needsSelfCheck: true, feedback: 'Vergleiche selbst mit der Musterlösung.' }
        }
      } else if (isCode && exercise.lang === 'java') {
        const code = String(answer ?? '')
        const r = await java.run(code, exercise.stdin ?? '')
        setOutput({ stdout: r.stdout, stderr: r.compiled ? r.stderr : formatDiagnostics(r.diagnostics) })
        const rules = gradeCodeStatic(exercise, code)
        if (!rules.correct) res = rules
        else if (!r.compiled) {
          res = { score: 0, correct: false, feedback: 'Der Code lässt sich nicht übersetzen — sieh dir die Compilermeldung an.' }
        } else if (r.exception && !exercise.expectedOutput) {
          res = { score: 0, correct: false, feedback: `Laufzeitfehler: ${r.exception.type}` }
        } else if (exercise.expectedOutput) {
          const ok = normOutput(r.stdout) === normOutput(exercise.expectedOutput)
          res = {
            score: ok ? 1 : 0,
            correct: ok,
            feedback: ok
              ? 'Übersetzt und die Ausgabe stimmt exakt.'
              : r.exception
                ? `Das Programm bricht ab: ${r.exception.type}`
                : 'Übersetzt, aber die Ausgabe weicht ab — der Vergleich unten zeigt, wo.',
          }
        } else {
          res = { score: 0, correct: false, needsSelfCheck: true, feedback: 'Übersetzt fehlerfrei. Vergleiche mit der Musterlösung.' }
        }
      } else {
        res = gradeAnswer(exercise, answer)
      }

      setResult(res)
      if (!res.needsSelfCheck) {
        setEcho(res.correct ? 'ok' : 'bad')
        setTimeout(() => setEcho(null), 800)
      }
      if (!res.needsSelfCheck && !examMode) finish(res.score)
    } finally {
      setBusy(null)
    }
  }, [answer, exercise, python, java, busy, isCode, examMode, finish])

  const runOnly = useCallback(async () => {
    if (busy) return
    setBusy('run')
    try {
      const code = String(answer ?? '')
      if (exercise.lang === 'python') {
        const r = await python.run(code, [], exercise.stdin ?? '')
        setOutput({ stdout: r.stdout, stderr: r.error })
      } else {
        const r = await java.run(code, exercise.stdin ?? '')
        setOutput({ stdout: r.stdout, stderr: r.compiled ? r.stderr : formatDiagnostics(r.diagnostics) })
      }
    } finally {
      setBusy(null)
    }
  }, [answer, exercise, python, java, busy])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!result) void check()
        return
      }
      /* Tasten 1–3 setzen die Sicherheit — aber nur, wenn gerade nicht
         in ein Eingabefeld getippt wird. */
      const el = document.activeElement as HTMLElement | null
      const typing =
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable ||
          !!el.closest('.cm-editor'))
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (!result && !examMode && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        setConfidence((Number(e.key) - 1) as Confidence)
        return
      }
      /* Weiterblättern per Eingabetaste, sobald gebucht ist — damit eine
         Runde flüssig durchläuft, ohne zur Maus zu greifen. */
      if (recorded && onNext && !examMode && e.key === 'Enter') {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [check, result, examMode, recorded, onNext])

  const solved = result?.correct === true
  const loading = busy === 'check' && python.status === 'loading'

  /* Soll-Ist-Vergleich: bei „Ausgabe vorhersagen" gegen die Eingabe,
     bei Programmieraufgaben gegen die tatsächliche Programmausgabe. */
  const diff =
    result && !result.correct && exercise.expectedOutput
      ? exercise.type === 'predict-output'
        ? { expected: exercise.expectedOutput, got: String(answer ?? '') }
        : isCode && output && !output.stderr
          ? { expected: exercise.expectedOutput, got: output.stdout }
          : null
      : null

  return (
    <article>
      {/* Gelöstes Beispiel: Lösung und Erklärung stehen VOR dem Versuch.
          Bei einem neuen Thema bringt das mehr als Herumprobieren — und
          es kostet weniger Zeit. */}
      {support === 'beispiel' && !examMode && (
        <div className="mb-4 rounded-md border-l-2 border-l-accent border-y border-r border-rule bg-surface">
          <div className="px-5 py-4">
            <div className="eyebrow !text-accent">Gelöstes Beispiel · neues Thema</div>
            <p className="pretty mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink">
              Diese Aufgabe kommt mit fertiger Lösung. Bei einem Thema, das du zum ersten Mal siehst, bringt das
              Durchdenken einer richtigen Lösung mehr als das Suchen nach einer eigenen. Geh sie Schritt für Schritt
              durch, bis du jede Zeile begründen kannst — und schreib sie danach unten selbst hin.
            </p>
            {topic && (
              <a
                href={`/themen/${exercise.topicId}`}
                className="mt-2.5 inline-block text-[13px] text-accent hover:underline"
              >
                Theorie zu {topic.title} lesen →
              </a>
            )}
          </div>
          <div className="border-t border-rule px-5 py-4">
            <Solution exercise={exercise} open />
          </div>
        </div>
      )}

      {/* Kopfzeile — bewusst karg: Sprache, Thema, Schwierigkeit, Punkte.
          Alles Weitere („Klausurformat", Typbezeichnung) stand hier mal
          und hat nur vom Aufgabentext abgelenkt. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`tag ${exercise.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
          {exercise.lang === 'python' ? 'Python' : 'Java'}
        </span>
        <span className="truncate text-[12px] text-faint">{topic?.title ?? exercise.topicId}</span>

        <div className="ml-auto flex items-center gap-3">
          <span
            title={`Schwierigkeit: ${DIFF[exercise.difficulty]} (${exercise.difficulty}/5)`}
            className="flex gap-[3px]"
            aria-label={`Schwierigkeit ${exercise.difficulty} von 5`}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-[5px] w-[5px] rounded-[1px] ${i <= exercise.difficulty ? 'bg-accent' : 'bg-sink'}`}
              />
            ))}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-faint">{exercise.points} P</span>
          {!examMode && typeof position === 'number' && typeof total === 'number' && (
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {position + 1}/{total}
            </span>
          )}
          {onToggleFlag && (
            <button
              onClick={onToggleFlag}
              className={`text-[12.5px] transition-colors ${flagged ? 'text-accent' : 'text-faint hover:text-ink'}`}
              title="Zum Wiederholen markieren"
              aria-pressed={flagged}
            >
              {flagged ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      <div className={`panel overflow-hidden ${echo === 'ok' ? 'pulse-ok' : echo === 'bad' ? 'pulse-bad' : ''}`}>
        <header className="border-b border-rule px-5 py-5">
          <h2 className="balance text-[19px] leading-snug">{exercise.title}</h2>
          <div className="mt-2">
            <Markdown>{exercise.prompt}</Markdown>
          </div>
          {exercise.constraints?.length ? (
            <ul className="mt-3 space-y-1">
              {exercise.constraints.map((c, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-neg">
                  <span aria-hidden>▸</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {exercise.mermaid && <Mermaid chart={exercise.mermaid} />}
          {exercise.code && <CodeBlock code={exercise.code} language={exercise.lang} maxHeight={520} />}
        </header>

        <motion.div className="px-5 py-5" animate={echo === 'bad' ? { x: [0, -5, 4, -2, 0] } : {}} transition={{ duration: 0.34 }}>
          <AnswerArea
            exercise={exercise}
            answer={answer}
            setAnswer={setAnswer}
            disabled={!!result && !result.needsSelfCheck && !examMode}
            result={result}
            onSubmit={check}
            onRun={runnable ? runOnly : undefined}
          />

          <AnimatePresence>
            {output && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-4">
                  <Console stdout={output.stdout} stderr={output.stderr} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sicherheitsabfrage — bewusst VOR der Prüfung und in einer
            eigenen Zeile, damit sie nicht neben dem Prüfknopf untergeht. */}
        {!examMode && !result && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule px-5 py-2.5">
            <span className="eyebrow">Wie sicher bist du?</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Sicherheitseinschätzung">
              {CONFIDENCE.map((c) => (
                <button
                  key={c.value}
                  role="radio"
                  aria-checked={confidence === c.value}
                  onClick={() => setConfidence(confidence === c.value ? null : (c.value as Confidence))}
                  title={`${c.hint} (Taste ${c.value + 1})`}
                  className={`rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
                    confidence === c.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-rule text-muted hover:border-ruleStrong hover:text-ink'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-faint">
              freiwillig · macht Selbstbild und Können vergleichbar
            </span>
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-2 border-t border-rule bg-raised/70 px-5 py-3.5">
          {examMode && (
            <span className="text-[12.5px] text-faint">
              In der Klausursimulation gibt es keine Rückmeldung — bewertet wird bei der Abgabe.
            </span>
          )}

          {!examMode && !result && (
            <button onClick={check} disabled={!!busy} className="btn-primary">
              {busy === 'check' ? (
                <>
                  <Spinner /> {loading ? 'Python startet …' : 'Wird geprüft …'}
                </>
              ) : (
                'Antwort prüfen'
              )}
            </button>
          )}

          {runnable && !result && (
            <button
              onClick={runOnly}
              disabled={!!busy}
              className={`btn-secondary ${examMode ? 'ml-auto' : ''}`}
              title="Nur ausführen, ohne zu bewerten"
            >
              {busy === 'run' ? <Spinner /> : null} Ausführen
            </button>
          )}

          {!examMode && !result && (exercise.hints?.length ?? 0) > hints && (
            <button onClick={() => setHints((h) => h + 1)} className="btn-quiet">
              Tipp {hints + 1} von {exercise.hints!.length}
            </button>
          )}

          {onSkip && !result && (
            <button onClick={onSkip} className="btn-quiet ml-auto !text-faint">
              Überspringen
            </button>
          )}

          {!examMode && !result && !revealed && (
            <button
              onClick={() => {
                setRevealed(true)
                setResult({ score: 0, correct: false, needsSelfCheck: true, feedback: 'Lösung angesehen.' })
              }}
              className={`btn-quiet ${onSkip ? '' : 'ml-auto'}`}
            >
              Lösung zeigen
            </button>
          )}

          {result && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!recorded && (
                <button
                  onClick={() => {
                    setResult(null)
                    setOutput(null)
                    finished.current = false
                    started.current = Date.now()
                    if (!examMode) setAnswer(initialAnswer(exercise))
                  }}
                  className="btn-quiet"
                >
                  Nochmal versuchen
                </button>
              )}
              {recorded && onNext && !examMode && (
                <button onClick={onNext} className="btn-primary" autoFocus>
                  Weiter
                  <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 7h9M7.5 3.5 11 7l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </footer>
      </div>

      {/* Tipps */}
      <AnimatePresence>
        {hints > 0 && !revealed && (
          <motion.ol
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 space-y-2"
          >
            {exercise.hints!.slice(0, hints).map((h, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="rounded-lg border border-accent/30 bg-accentSoft px-4 py-3"
              >
                <div className="eyebrow !text-accent">Tipp {i + 1}</div>
                <Markdown className="mt-1 !text-[14px]">{h}</Markdown>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>

      {/* Rückmeldung */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="mt-4 space-y-3"
          >
            <Feedback
              exercise={exercise}
              result={result}
              revealed={revealed}
              onSelfGrade={finish}
              examMode={examMode}
              confidence={confidence}
            />
            {diff && <OutputDiff expected={diff.expected} got={diff.got} />}
            {!examMode && <Solution exercise={exercise} open={!solved || revealed} />}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

/* ==================================================================== */

function Feedback({
  exercise,
  result,
  revealed,
  onSelfGrade,
  examMode,
  confidence,
}: {
  exercise: Ex
  result: GradeResult
  revealed: boolean
  onSelfGrade: (score: number) => void
  examMode: boolean
  confidence: Confidence | null
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const solved = result.correct
  /* Statusfarbe nur als Strich am Rand — eine vollflächig eingefärbte
     Karte schreit, und nach der zwanzigsten Aufgabe ermüdet das. */
  const tone = solved
    ? 'border-l-pos'
    : result.needsSelfCheck
      ? 'border-l-accent'
      : result.nearMiss
        ? 'border-l-oxide'
        : 'border-l-neg'

  /* Hypercorrection: Ein Fehler, bei dem man sich SICHER war, wird nach
     einer Rückmeldung besonders zuverlässig korrigiert — vorausgesetzt,
     der Widerspruch wird bemerkt. Genau dafür ist dieser Kasten da. */
  const overconfident = !solved && !result.needsSelfCheck && confidence === 2
  const underconfident = solved && confidence === 0

  return (
    <div className={`space-y-3`}>
      {overconfident && (
        <div className="rounded-md border-l-2 border-l-neg border-y border-r border-rule bg-surface px-5 py-4">
          <div className="eyebrow !text-neg">Achtung — hier lagst du sicher daneben</div>
          <p className="pretty mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink">
            Du warst dir sicher und es war trotzdem falsch. Das ist die wertvollste Stelle im ganzen Lernen: Falsches
            Wissen, das sich richtig anfühlt, hält sich bis in die Klausur — es sei denn, man sieht den Widerspruch
            einmal deutlich. Lies die Erklärung unten wirklich, nicht überfliegend. Diese Aufgabe kommt am Ende der
            Runde noch einmal.
          </p>
        </div>
      )}

      {underconfident && (
        <div className="rounded-md border border-rule bg-surface px-5 py-3">
          <p className="text-[13.5px] text-muted">
            <span className="font-medium text-pos">Richtig — und du hattest geraten.</span> Das heißt: Du kannst mehr,
            als du dir zutraust. Bei der nächsten Aufgabe ruhig eine Stufe höher einschätzen.
          </p>
        </div>
      )}

      <div className={`rounded-md border border-rule border-l-2 bg-surface px-5 py-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center ${
            solved ? 'text-pos' : result.needsSelfCheck ? 'text-accent' : 'text-neg'
          }`}
          aria-hidden
        >
          {solved ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" className="draw" />
            </svg>
          ) : result.needsSelfCheck ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span
              className={`text-[16px] font-semibold ${
                solved ? 'text-pos' : result.needsSelfCheck ? 'text-ink' : result.nearMiss ? 'text-oxide' : 'text-neg'
              }`}
            >
              {solved
                ? 'Richtig'
                : result.needsSelfCheck
                  ? 'Selbst einschätzen'
                  : result.nearMiss
                    ? 'Fast richtig'
                    : 'Noch nicht richtig'}
            </span>
            {!result.needsSelfCheck && (
              <span className="tabnum text-[13px] text-muted">
                <AnimatedNumber value={Math.round(result.score * exercise.points * 10) / 10} decimals={1} /> von{' '}
                {exercise.points} Punkten
              </span>
            )}
          </div>
          {result.feedback && <p className="mt-1 text-[13.5px] text-muted">{result.feedback}</p>}

          {result.parts?.length ? (
            <ul className="mt-3 space-y-1.5">
              {result.parts.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, ease: EASE, delay: i * 0.05 }}
                  className="flex gap-2.5 border-b border-rule/70 py-2 text-[13px] last:border-b-0"
                >
                  <span className={`shrink-0 font-semibold ${p.correct ? 'text-pos' : 'text-neg'}`} aria-hidden>
                    {p.correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    {p.note && <div className="text-muted">{p.note}</div>}
                    {!p.correct && p.expected !== undefined && (
                      <div className="mt-1 font-mono text-[12px]">
                        {p.got ? (
                          <div>
                            <span className="text-faint">deine Antwort: </span>
                            <span className="text-neg">{p.got}</span>
                          </div>
                        ) : null}
                        <div>
                          <span className="text-faint">erwartet: </span>
                          <span className="text-pos">{p.expected}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : null}

          {result.needsSelfCheck && !examMode && (
            <div className="mt-4">
              <div className="eyebrow">
                {confidence !== null
                  ? `Vorher: „${CONFIDENCE[confidence].label}“ — und, hat es gestimmt?`
                  : 'Wie sicher konntest du das?'}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: 'Gar nicht', score: 0 },
                  { label: 'Mit Mühe', score: 0.5 },
                  { label: 'Gut', score: 0.85 },
                  { label: 'Sicher', score: 1 },
                ].map((b, i) => (
                  <button
                    key={b.label}
                    onClick={() => {
                      setPicked(i)
                      onSelfGrade(revealed ? Math.min(b.score, 0.4) : b.score)
                    }}
                    className={`btn-secondary ${picked === i ? '!border-accent !text-accent' : ''}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {revealed && (
                <p className="mt-2 text-[12.5px] text-faint">
                  Weil du die Lösung gesehen hast, zählt die Aufgabe nur teilweise und kommt bald wieder.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Stolperfallen sofort bei einem Fehler zeigen, nicht erst
          zusammengeklappt in der Musterlösung — an dieser Stelle ist die
          Aufmerksamkeit am höchsten. */}
      {!solved && !result.needsSelfCheck && exercise.pitfalls?.length ? (
        <div className="rounded-md border border-rule bg-surface px-5 py-4">
          <div className="eyebrow">Woran es meistens liegt</div>
          <ul className="mt-2 space-y-1.5">
            {exercise.pitfalls.slice(0, 3).map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-[1px] bg-oxide" aria-hidden />
                <Markdown className="!text-[13.5px]">{p}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Musterlösung und Erklärung — in der Reihenfolge, in der man sie
 * braucht:
 *
 *   1. MERKSATZ — die ein, zwei Sätze, die man mitnehmen soll. Groß,
 *      zuerst, unübersehbar. Niemand liest nach jeder Aufgabe einen
 *      Aufsatz; diesen einen Satz liest jeder.
 *   2. Die Lösung selbst (Code, richtige Kreuze, Korrekturen).
 *   3. Die ausführliche Begründung — vorhanden, aber einen Klick
 *      entfernt statt als Textwand dazwischen.
 *   4. Stolperfallen und die Fundstelle in den Vorlesungsfolien.
 */
export function Solution({ exercise, open }: { exercise: Ex; open: boolean }) {
  const { lead, rest } = splitLead(exercise.explanation ?? '')

  return (
    <Disclosure summary="Musterlösung und Erklärung" defaultOpen={open} key={exercise.id + String(open)}>
      <div className="space-y-5">
        {lead && (
          <div className="border-l-2 border-accent pl-4">
            <div className="eyebrow !text-accent">Merksatz</div>
            <Markdown className="mt-1.5 !text-[15.5px] !leading-[1.65] [&_p]:!my-0 [&_p]:font-medium">
              {lead}
            </Markdown>
          </div>
        )}

        {exercise.type === 'mc' || exercise.type === 'multi-mc' ? (
          <ul className="space-y-px overflow-hidden rounded-md border border-rule">
            {exercise.choices?.map((c) => (
              <li
                key={c.id}
                className={`border-b border-rule px-3.5 py-2.5 text-[13.5px] last:border-b-0 ${
                  c.correct ? 'border-l-2 border-l-pos bg-pos/4' : 'border-l-2 border-l-transparent'
                }`}
              >
                <span className={c.correct ? 'font-medium' : 'text-muted'}>{c.text}</span>
                {c.why && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{c.why}</div>}
              </li>
            ))}
          </ul>
        ) : exercise.type === 'find-errors' && exercise.errors?.length ? (
          <ul className="space-y-2">
            {exercise.errors.map((e, i) => (
              <li key={i} className="rounded-md border border-rule px-3.5 py-2.5">
                <div className="eyebrow">
                  Fehler {i + 1}
                  {e.line ? ` · Zeile ${e.line}` : ''}
                </div>
                <div className="mt-1.5 font-mono text-[13px]">
                  <span className="text-neg line-through decoration-neg/50">{e.wrong}</span>
                  <span className="mx-2 text-faint" aria-hidden>→</span>
                  <span className="text-pos">{e.fix}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{e.why}</p>
              </li>
            ))}
          </ul>
        ) : looksLikeCode(exercise.solution) ? (
          <CodeBlock code={exercise.solution} language={exercise.lang} caption="Musterlösung" />
        ) : (
          <Markdown>{exercise.solution}</Markdown>
        )}

        {exercise.expectedOutput && exercise.type !== 'predict-output' && (
          <CodeBlock code={exercise.expectedOutput} language="text" caption="Erwartete Ausgabe" showLineNumbers={false} />
        )}

        {rest && (
          <Disclosure tone="quiet" summary={<span className="text-muted">Ausführliche Begründung</span>}>
            <Markdown className="!text-[14px]">{rest}</Markdown>
          </Disclosure>
        )}
        {!lead && !rest && exercise.explanation && <Markdown>{exercise.explanation}</Markdown>}

        {exercise.pitfalls?.length ? (
          <div>
            <div className="eyebrow">Stolperfallen</div>
            <ul className="mt-2 space-y-1.5">
              {exercise.pitfalls.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                  <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-[1px] bg-oxide" aria-hidden />
                  <Markdown className="!text-[13px] !text-muted [&>p]:!my-0">{p}</Markdown>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {exercise.sources?.length ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-rule pt-3">
            <span className="eyebrow">Nachlesen</span>
            <SourceList sources={exercise.sources} />
          </div>
        ) : null}
      </div>
    </Disclosure>
  )
}

/* ==================================================================== */

function AnswerArea({
  exercise,
  answer,
  setAnswer,
  disabled,
  result,
  onSubmit,
  onRun,
}: {
  exercise: Ex
  answer: unknown
  setAnswer: (v: unknown) => void
  disabled: boolean
  result: GradeResult | null
  onSubmit: () => void
  onRun?: () => void
}) {
  switch (exercise.type) {
    case 'mc':
    case 'multi-mc': {
      const picked = new Set<string>(Array.isArray(answer) ? (answer as string[]) : answer ? [String(answer)] : [])
      const multi = exercise.type === 'multi-mc'
      return (
        <div className="space-y-2">
          {multi && <p className="mb-1 text-[12.5px] text-faint">Mehrere Antworten können richtig sein.</p>}
          {exercise.choices?.map((c, i) => {
            const on = picked.has(c.id)
            const shown = !!result
            return (
              <motion.button
                key={c.id}
                disabled={disabled}
                whileTap={disabled ? undefined : { scale: 0.995 }}
                onClick={() => {
                  if (multi) {
                    const next = new Set(picked)
                    if (next.has(c.id)) next.delete(c.id)
                    else next.add(c.id)
                    setAnswer([...next])
                  } else setAnswer(c.id)
                }}
                animate={
                  shown && c.correct
                    ? { borderColor: 'rgb(var(--pos) / 0.5)' }
                    : shown && on && !c.correct
                      ? { borderColor: 'rgb(var(--neg) / 0.5)' }
                      : {}
                }
                transition={{ duration: 0.3, delay: shown ? i * 0.05 : 0 }}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors
                  ${
                    shown && c.correct
                      ? 'bg-posSoft'
                      : shown && on && !c.correct
                        ? 'bg-negSoft'
                        : on
                          ? 'border-accent bg-accentSoft'
                          : 'border-rule hover:border-ruleStrong hover:bg-raised'
                  } disabled:cursor-default`}
              >
                <span
                  className={`mt-px grid h-5 w-5 shrink-0 place-items-center border text-[11px] font-semibold transition-colors
                    ${multi ? 'rounded-[5px]' : 'rounded-full'}
                    ${on ? 'border-accent bg-accent text-accentInk' : 'border-ruleStrong text-faint'}`}
                >
                  {on ? '✓' : c.id.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <Markdown className="!text-[14px] [&>p]:!my-0">{c.text}</Markdown>
                </span>
              </motion.button>
            )
          })}
        </div>
      )
    }

    case 'fill-gaps': {
      const vals = (answer ?? {}) as Record<string, string>
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {exercise.gaps?.map((g, i) => {
            const part = result?.parts?.find((p) => p.id === g.id)
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: i * 0.04 }}
              >
                <label className="label" htmlFor={`gap-${g.id}`}>
                  Lücke {g.id}
                </label>
                <input
                  id={`gap-${g.id}`}
                  className={`field-mono ${part ? (part.correct ? '!border-pos' : '!border-neg') : ''}`}
                  value={vals[String(g.id)] ?? ''}
                  disabled={disabled}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  onChange={(e) => setAnswer({ ...vals, [String(g.id)]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onSubmit()
                    }
                  }}
                />
              </motion.div>
            )
          })}
        </div>
      )
    }

    case 'predict-output':
      return (
        <div>
          <label className="label" htmlFor="out">
            Was gibt das Programm aus?
          </label>
          <textarea
            id="out"
            className="field-mono"
            rows={Math.min(14, Math.max(3, (exercise.expectedOutput ?? '').split('\n').length + 1))}
            value={String(answer ?? '')}
            disabled={disabled}
            spellCheck={false}
            placeholder="Zeile für Zeile — bei einem Abbruch den Fehlertyp nennen"
            onChange={(e) => setAnswer(e.target.value)}
          />
          <p className="mt-1.5 text-[12.5px] text-faint">
            Zeilenumbrüche und Schreibweise zählen; in der Klausur wird die exakte Ausgabe erwartet.
          </p>
        </div>
      )

    case 'short-answer':
    case 'uml':
    case 'find-errors':
      return (
        <div>
          <label className="label" htmlFor="ans">
            {exercise.type === 'find-errors'
              ? 'Benenne jeden Fehler und gib die Korrektur an'
              : exercise.type === 'uml'
                ? 'Deine Antwort — Beschreibung oder Code'
                : 'Deine Antwort'}
          </label>
          <textarea
            id="ans"
            className="field"
            rows={6}
            value={String(answer ?? '')}
            disabled={disabled}
            placeholder="So formulieren, wie du es in der Klausur aufschreiben würdest …"
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>
      )

    default:
      return (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="label !mb-0">Deine Lösung</span>
            <span className="text-[12px] text-faint">⌘/Strg + ⏎ prüft</span>
          </div>
          <CodeEditor
            value={String(answer ?? '')}
            onChange={setAnswer}
            language={exercise.lang}
            readOnly={disabled}
            onSubmit={onSubmit}
            onRun={onRun}
          />
          {exercise.tests?.filter((t) => t.visible !== false).length ? (
            <div className="mt-3">
              <div className="eyebrow">Diese Beispiele müssen stimmen</div>
              <ul className="mt-1.5 space-y-1 font-mono text-[12px] text-muted">
                {exercise.tests.slice(0, 4).map((t, i) => (
                  <li key={i}>
                    {t.call} <span className="text-faint">→</span> {t.expected}
                  </li>
                ))}
                {exercise.tests.length > 4 && (
                  <li className="font-sans text-faint">und {exercise.tests.length - 4} weitere Tests</li>
                )}
              </ul>
            </div>
          ) : null}
        </div>
      )
  }
}

/* --------------------------- Hilfsfunktionen --------------------------- */

export function initialAnswer(ex: Ex): unknown {
  switch (ex.type) {
    case 'mc': return ''
    case 'multi-mc': return []
    case 'fill-gaps': return {}
    case 'code': return ex.starterCode ?? ''
    default: return ''
  }
}

function looksLikeCode(s: string): boolean {
  if (s.includes('```')) return false
  return /(^|\n)\s*(def |class |import |from |public |private |for |while |if |return |System\.out|print\()/.test(s)
}

function formatDiagnostics(diags: { line: number; message: string }[]): string {
  if (!diags.length) return 'Kompilierfehler'
  return diags.map((d) => `Zeile ${d.line}: ${d.message}`).join('\n')
}
