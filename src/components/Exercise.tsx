'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise as Ex } from '@/lib/types'
import { combineCodeResult, gradeAnswer, gradeCodeStatic, normOutput, type GradeResult } from '@/lib/grade'
import { usePython } from '@/lib/usePython'
import { useJava } from '@/lib/useJava'
import { TOPIC_BY_ID } from '@/content/topics'
import { CodeBlock, Console } from './CodeBlock'
import { CodeEditor } from './CodeEditor'
import { Markdown } from './Markdown'
import { Mermaid } from './Mermaid'
import { Disclosure, Spinner } from './ui'

const DIFF = ['', 'Aufwärmen', 'Leicht', 'Klausurniveau', 'Schwer', 'Härtetest']

export interface ExerciseResult {
  score: number
  ms: number
  usedHints: number
  revealed: boolean
}

export function ExerciseView({
  exercise,
  onDone,
  onSkip,
  position,
  total,
  examMode = false,
  onAnswerChange,
  flagged,
  onToggleFlag,
}: {
  exercise: Ex
  onDone: (r: ExerciseResult) => void
  onSkip?: () => void
  position?: number
  total?: number
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
  const [busy, setBusy] = useState<'check' | 'run' | null>(null)
  const [output, setOutput] = useState<{ stdout: string; stderr?: string | null } | null>(null)
  const started = useRef(Date.now())

  const isCode = exercise.type === 'code'
  const runnable = isCode || (exercise.lang === 'java' && !!exercise.code)

  useEffect(() => {
    setAnswer(initialAnswer(exercise))
    setResult(null)
    setHints(0)
    setRevealed(false)
    setOutput(null)
    started.current = Date.now()
    if (isCode) {
      if (exercise.lang === 'python') python.preload()
      else java.preload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id])

  useEffect(() => {
    onAnswerChange?.(answer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer])

  const finish = useCallback(
    (score: number) => {
      onDone({ score, ms: Date.now() - started.current, usedHints: hints, revealed })
    },
    [hints, onDone, revealed],
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
                feedback: run.error ? `Fehler beim Ausführen: ${run.error}` : ok ? 'Die Ausgabe stimmt exakt.' : 'Die Ausgabe weicht noch ab.',
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
                : 'Übersetzt, aber die Ausgabe weicht ab.',
          }
        } else {
          res = { score: 0, correct: false, needsSelfCheck: true, feedback: 'Übersetzt fehlerfrei. Vergleiche mit der Musterlösung.' }
        }
      } else {
        res = gradeAnswer(exercise, answer)
      }

      setResult(res)
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
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [check, result])

  const solved = result?.correct === true
  const loading = busy === 'check' && python.status === 'loading'

  return (
    <article>
      {/* Kopfzeile: alles Nebensächliche klein und ruhig */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] text-muted">
        <span className={`tag ${exercise.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
          {exercise.lang === 'python' ? 'Python' : 'Java'}
        </span>
        <span>{topic?.title ?? exercise.topicId}</span>
        <span className="text-faint">·</span>
        <span title={`Schwierigkeit ${exercise.difficulty} von 5`}>{DIFF[exercise.difficulty]}</span>
        <span className="text-faint">·</span>
        <span className="tabnum">{exercise.points} P</span>
        {exercise.examStyle && <span className="tag tag-warn">Klausurformat</span>}

        <div className="ml-auto flex items-center gap-2.5">
          {!examMode && typeof position === 'number' && typeof total === 'number' && (
            <span className="tabnum text-faint">
              {position + 1} / {total}
            </span>
          )}
          {onToggleFlag && (
            <button
              onClick={onToggleFlag}
              className={`text-[12.5px] transition-colors ${flagged ? 'text-warn' : 'text-faint hover:text-ink'}`}
              title="Zum Wiederholen markieren"
            >
              {flagged ? '★ markiert' : '☆ merken'}
            </button>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <header className="border-b border-line px-5 py-4">
          <h2 className="balance text-[17px] font-semibold">{exercise.title}</h2>
          <div className="mt-1.5">
            <Markdown>{exercise.prompt}</Markdown>
          </div>
          {exercise.constraints?.length ? (
            <ul className="mt-2.5 space-y-1">
              {exercise.constraints.map((c, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-bad">
                  <span aria-hidden>▸</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {exercise.mermaid && <Mermaid chart={exercise.mermaid} />}
          {exercise.code && <CodeBlock code={exercise.code} language={exercise.lang} maxHeight={520} />}
        </header>

        <div className="px-5 py-4">
          <AnswerArea
            exercise={exercise}
            answer={answer}
            setAnswer={setAnswer}
            disabled={!!result && !result.needsSelfCheck && !examMode}
            result={result}
            onSubmit={check}
            onRun={runnable ? runOnly : undefined}
          />

          {output && (
            <div className="mt-3">
              <Console stdout={output.stdout} stderr={output.stderr} />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-sunken px-5 py-3">
          {examMode && (
            <span className="text-[12.5px] text-faint">
              In der Klausursimulation gibt es keine Rückmeldung — bewertet wird erst bei der Abgabe.
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
              <button
                onClick={() => {
                  setResult(null)
                  setOutput(null)
                  if (!examMode) setAnswer(initialAnswer(exercise))
                }}
                className="btn-quiet"
              >
                Nochmal versuchen
              </button>
              {!result.needsSelfCheck && !examMode && (
                <button onClick={() => finish(result.score)} className="btn-primary">
                  Weiter
                </button>
              )}
            </div>
          )}
        </footer>
      </div>

      {hints > 0 && !revealed && (
        <ol className="mt-3 space-y-2">
          {exercise.hints!.slice(0, hints).map((h, i) => (
            <li key={i} className="enter rounded-md border border-warn/25 bg-warnWash px-4 py-2.5">
              <div className="eyebrow !text-warn">Tipp {i + 1}</div>
              <Markdown className="mt-1 !text-[14px]">{h}</Markdown>
            </li>
          ))}
        </ol>
      )}

      {result && (
        <div className="enter mt-4 space-y-3">
          <Feedback exercise={exercise} result={result} revealed={revealed} onSelfGrade={finish} examMode={examMode} />
          {!examMode && <Solution exercise={exercise} open={!solved || revealed} />}
        </div>
      )}
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
}: {
  exercise: Ex
  result: GradeResult
  revealed: boolean
  onSelfGrade: (score: number) => void
  examMode: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const solved = result.correct
  const tone = solved
    ? 'border-ok/35 bg-okWash'
    : result.needsSelfCheck
      ? 'border-line bg-surface'
      : result.nearMiss
        ? 'border-warn/35 bg-warnWash'
        : 'border-bad/35 bg-badWash'

  return (
    <div className={`rounded-lg border px-5 py-4 ${tone}`}>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span
          className={`text-[15px] font-semibold ${
            solved ? 'text-ok' : result.needsSelfCheck ? 'text-ink' : result.nearMiss ? 'text-warn' : 'text-bad'
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
            {Math.round(result.score * exercise.points * 10) / 10} von {exercise.points} Punkten
          </span>
        )}
      </div>
      {result.feedback && <p className="mt-1 text-[13.5px] text-muted">{result.feedback}</p>}

      {result.parts?.length ? (
        <ul className="mt-3 space-y-1.5">
          {result.parts.map((p, i) => (
            <li
              key={i}
              className={`flex gap-2.5 rounded border px-3 py-2 text-[13px] ${
                p.correct ? 'border-ok/25 bg-surface' : 'border-line bg-surface'
              }`}
            >
              <span className={`shrink-0 font-semibold ${p.correct ? 'text-ok' : 'text-bad'}`} aria-hidden>
                {p.correct ? '✓' : '✗'}
              </span>
              <div className="min-w-0 flex-1">
                {p.note && <div className="text-muted">{p.note}</div>}
                {!p.correct && p.expected !== undefined && (
                  <div className="mt-1 font-mono text-[12px]">
                    {p.got ? (
                      <div>
                        <span className="text-faint">deine Antwort: </span>
                        <span className="text-bad">{p.got}</span>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-faint">erwartet: </span>
                      <span className="text-ok">{p.expected}</span>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {result.needsSelfCheck && !examMode && (
        <div className="mt-4">
          <div className="eyebrow">Wie sicher konntest du das?</div>
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
  )
}

export function Solution({ exercise, open }: { exercise: Ex; open: boolean }) {
  return (
    <Disclosure summary="Musterlösung und Erklärung" defaultOpen={open} key={exercise.id + String(open)}>
      <div className="space-y-4">
        {exercise.type === 'mc' || exercise.type === 'multi-mc' ? (
          <ul className="space-y-1.5">
            {exercise.choices?.map((c) => (
              <li key={c.id} className={`rounded border px-3 py-2 text-[13.5px] ${c.correct ? 'border-ok/35 bg-okWash' : 'border-line'}`}>
                <span className={c.correct ? 'font-medium text-ok' : 'text-muted'}>
                  {c.correct ? '✓ ' : '✗ '}
                  {c.text}
                </span>
                {c.why && <div className="mt-0.5 text-[13px] text-muted">{c.why}</div>}
              </li>
            ))}
          </ul>
        ) : exercise.type === 'find-errors' && exercise.errors?.length ? (
          <ul className="space-y-2">
            {exercise.errors.map((e, i) => (
              <li key={i} className="rounded border border-line px-3.5 py-2.5">
                <div className="eyebrow !text-bad">
                  Fehler {i + 1}
                  {e.line ? ` — Zeile ${e.line}` : ''}
                </div>
                <div className="mt-1 font-mono text-[13px] text-bad line-through">{e.wrong}</div>
                <div className="font-mono text-[13px] text-ok">{e.fix}</div>
                <p className="mt-1 text-[13px] text-muted">{e.why}</p>
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

        <div>
          <div className="eyebrow">Warum</div>
          <Markdown className="mt-1">{exercise.explanation}</Markdown>
        </div>

        {exercise.pitfalls?.length ? (
          <div className="rounded border border-warn/25 bg-warnWash px-4 py-3">
            <div className="eyebrow !text-warn">Typische Fehler</div>
            <ul className="mt-1.5 space-y-1 text-[13.5px]">
              {exercise.pitfalls.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-warn" aria-hidden>–</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {exercise.sources?.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-[12px] text-faint">
            <span className="eyebrow">Quelle</span>
            {exercise.sources.map((s, i) => (
              <span key={i}>
                {s.file}
                {s.page ? `, S. ${s.page}` : ''}
                {s.label ? ` — ${s.label}` : ''}
                {i < exercise.sources!.length - 1 ? ';' : ''}
              </span>
            ))}
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
        <div className="space-y-1.5">
          {multi && <p className="mb-1 text-[12.5px] text-faint">Mehrere Antworten können richtig sein.</p>}
          {exercise.choices?.map((c) => {
            const on = picked.has(c.id)
            const shown = !!result
            return (
              <button
                key={c.id}
                disabled={disabled}
                onClick={() => {
                  if (multi) {
                    const next = new Set(picked)
                    if (next.has(c.id)) next.delete(c.id)
                    else next.add(c.id)
                    setAnswer([...next])
                  } else setAnswer(c.id)
                }}
                className={`flex w-full items-start gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors
                  ${
                    shown && c.correct
                      ? 'border-ok/45 bg-okWash'
                      : shown && on && !c.correct
                        ? 'border-bad/45 bg-badWash'
                        : on
                          ? 'border-accent bg-accentWash'
                          : 'border-line hover:border-lineStrong hover:bg-sunken'
                  } disabled:cursor-default`}
              >
                <span
                  className={`mt-px grid h-[19px] w-[19px] shrink-0 place-items-center border text-[11px] font-semibold
                    ${multi ? 'rounded-[4px]' : 'rounded-full'}
                    ${on ? 'border-accent bg-accent text-accentInk' : 'border-lineStrong text-faint'}`}
                >
                  {on ? '✓' : c.id.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <Markdown className="!text-[14px] [&>p]:!my-0">{c.text}</Markdown>
                </span>
              </button>
            )
          })}
        </div>
      )
    }

    case 'fill-gaps': {
      const vals = (answer ?? {}) as Record<string, string>
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {exercise.gaps?.map((g) => {
            const part = result?.parts?.find((p) => p.id === g.id)
            return (
              <div key={g.id}>
                <label className="label" htmlFor={`gap-${g.id}`}>
                  Lücke {g.id}
                </label>
                <input
                  id={`gap-${g.id}`}
                  className={`field-mono ${part ? (part.correct ? '!border-ok' : '!border-bad') : ''}`}
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
              </div>
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
            <div className="mt-2.5">
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
