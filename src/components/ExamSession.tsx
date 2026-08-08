'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exam, ExamAttempt, ExamTask, Exercise, ExerciseMeta, TaskBlueprint } from '@/lib/types'
import { loadExam, loadExercises } from '@/lib/content'
import { gradeAnswer, normOutput, combineCodeResult, type GradeResult } from '@/lib/grade'
import { percentToGrade } from '@/lib/mastery'
import { useStore } from '@/lib/store'
import { usePython } from '@/lib/usePython'
import { useJava } from '@/lib/useJava'
import { ExerciseView, Solution, initialAnswer } from './Exercise'
import { Markdown } from './Markdown'
import { CodeBlock } from './CodeBlock'
import { Dialog, Loading, Meter, Spinner } from './ui'
import { Page } from './Shell'

/* ==================================================================== *
 *  Klausursimulation
 *
 *  Feste Klausuren kommen wortgleich aus der Datei, generierte werden bei
 *  jedem Start neu aus der Aufgabenbank gezogen — gleicher Bauplan,
 *  andere Aufgaben.
 * ==================================================================== */

interface Slot {
  task: ExamTask
  exercise: Exercise
  /** Punkte dieses Slots innerhalb der Aufgabe */
  points: number
}

type Phase = 'intro' | 'running' | 'grading' | 'result'

export function ExamSession({ examId }: { examId: string }) {
  const { ready, index, recordExam, recordAnswer, progress } = useStore()
  const python = usePython()
  const java = useJava()

  const [exam, setExam] = useState<Exam | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [cursor, setCursor] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [results, setResults] = useState<Record<string, GradeResult>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitted = useRef(false)

  /* --------------------------- Zusammenstellen --------------------------- */

  useEffect(() => {
    let alive = true
    loadExam(examId)
      .then((e) => alive && setExam(e))
      .catch(() => alive && setError('Diese Klausur konnte nicht geladen werden.'))
    return () => {
      alive = false
    }
  }, [examId])

  const assemble = useCallback(async () => {
    if (!exam || !index) return
    const built: Slot[] = []
    for (const task of exam.tasks) {
      let list: Exercise[] = []
      if (task.inline?.length) {
        list = task.inline
      } else if (task.exerciseIds?.length) {
        const metas = task.exerciseIds
          .map((id) => index.items.find((i) => i.id === id))
          .filter((m): m is ExerciseMeta => !!m)
        list = await loadExercises(metas)
      } else if (task.blueprint) {
        list = await loadExercises(drawFromBank(task.blueprint, index.items, built.map((s) => s.exercise.id)))
      }
      const per = list.length ? task.points / list.length : task.points
      for (const ex of list) built.push({ task, exercise: ex, points: per })
    }
    setSlots(built)
    setAnswers(Object.fromEntries(built.map((s) => [s.exercise.id, initialAnswer(s.exercise)])))
    setCursor(0)
    const now = Date.now()
    setStartedAt(now)
    setRemaining(exam.minutes * 60_000)
    setPhase('running')
    submitted.current = false
    python.preload()
    java.preload()
  }, [exam, index, python, java])

  /* ------------------------------- Uhr ------------------------------- */

  useEffect(() => {
    if (phase !== 'running' || !exam) return
    const i = setInterval(() => {
      const left = exam.minutes * 60_000 - (Date.now() - startedAt)
      setRemaining(left)
      if (left <= 0) void submit()
    }, 1000)
    return () => clearInterval(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exam, startedAt])

  /* ------------------------------ Abgabe ------------------------------ */

  const submit = useCallback(async () => {
    if (!exam || !slots || submitted.current) return
    submitted.current = true
    setConfirmOpen(false)
    setPhase('grading')

    const graded: Record<string, GradeResult> = {}
    const scores: Record<string, number> = {}
    const maxScores: Record<string, number> = {}

    for (const slot of slots) {
      const ex = slot.exercise
      const answer = answers[ex.id]
      let res: GradeResult

      if (ex.type === 'code') {
        const code = String(answer ?? '')
        if (!code.trim()) {
          res = { score: 0, correct: false, feedback: 'Nicht bearbeitet.' }
        } else if (ex.lang === 'python') {
          const run = await python.run(code, ex.tests ?? [], ex.stdin ?? '')
          if (ex.tests?.length) res = combineCodeResult(ex, code, run.tests, run.error ?? undefined)
          else if (ex.expectedOutput) {
            const ok = !run.error && normOutput(run.stdout) === normOutput(ex.expectedOutput)
            res = { score: ok ? 1 : 0, correct: ok, feedback: ok ? 'Ausgabe stimmt.' : 'Ausgabe weicht ab.' }
          } else res = { score: 0, correct: false, needsSelfCheck: true, feedback: 'Bitte selbst mit der Musterlösung vergleichen.' }
        } else {
          const r = await java.run(code, ex.stdin ?? '')
          if (!r.compiled) res = { score: 0, correct: false, feedback: 'Lässt sich nicht übersetzen.' }
          else if (ex.expectedOutput) {
            const ok = normOutput(r.stdout) === normOutput(ex.expectedOutput)
            res = { score: ok ? 1 : 0, correct: ok, feedback: ok ? 'Ausgabe stimmt.' : 'Ausgabe weicht ab.' }
          } else res = { score: 0.5, correct: false, needsSelfCheck: true, feedback: 'Übersetzt. Bitte selbst bewerten.' }
        }
      } else {
        const empty =
          answer === '' || answer === undefined || (Array.isArray(answer) && answer.length === 0) ||
          (typeof answer === 'object' && answer !== null && Object.keys(answer).length === 0)
        res = empty ? { score: 0, correct: false, feedback: 'Nicht bearbeitet.' } : gradeAnswer(ex, answer)
      }

      graded[ex.id] = res
      scores[slot.task.id] = (scores[slot.task.id] ?? 0) + res.score * slot.points
      maxScores[slot.task.id] = (maxScores[slot.task.id] ?? 0) + slot.points

      const meta = index?.items.find((i) => i.id === ex.id)
      if (meta && !res.needsSelfCheck) {
        recordAnswer(meta, { score: res.score, ms: 90_000, usedHints: 0, revealed: false })
      }
    }

    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const max = exam.totalPoints || Object.values(maxScores).reduce((a, b) => a + b, 0)
    const a: ExamAttempt = {
      id: `${exam.id}-${startedAt}`,
      examId: exam.id,
      startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - startedAt,
      answers,
      scores,
      maxScores,
      total,
      max,
      grade: percentToGrade((total / Math.max(1, max)) * 100),
    }
    setResults(graded)
    setAttempt(a)
    recordExam(a)
    setPhase('result')
    window.scrollTo({ top: 0 })
  }, [exam, slots, answers, startedAt, python, java, index, recordAnswer, recordExam])

  /* ------------------------------ Anzeige ------------------------------ */

  if (error) {
    return (
      <Page title="Klausur">
        <div className="panel border-bad/35 bg-badWash px-5 py-4 text-[14px] text-bad">{error}</div>
        <Link href="/klausur" className="btn-secondary mt-4">
          Zurück zur Übersicht
        </Link>
      </Page>
    )
  }

  if (!ready || !exam || !index) {
    return (
      <Page title="Klausur">
        <Loading />
      </Page>
    )
  }

  if (phase === 'intro') {
    const previous = progress.exams.filter((a) => a.examId === exam.id)
    return (
      <Page title={exam.title} lead={exam.subtitle}>
        <div className="panel max-w-prose px-5 py-5">
          <dl className="grid grid-cols-3 gap-4 border-b border-line pb-4">
            <div>
              <dt className="eyebrow">Bearbeitungszeit</dt>
              <dd className="tabnum mt-1 text-[20px] font-semibold">{exam.minutes} min</dd>
            </div>
            <div>
              <dt className="eyebrow">Punkte</dt>
              <dd className="tabnum mt-1 text-[20px] font-semibold">
                {exam.totalPoints}
                {exam.bonusPoints ? <span className="text-[14px] font-normal text-muted"> +{exam.bonusPoints}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Aufgaben</dt>
              <dd className="tabnum mt-1 text-[20px] font-semibold">{exam.tasks.length}</dd>
            </div>
          </dl>

          {exam.note && (
            <div className="mt-4">
              <div className="eyebrow">Hinweise</div>
              <Markdown className="mt-1.5 !text-[13.5px]">{exam.note}</Markdown>
            </div>
          )}

          <p className="mt-4 text-[13.5px] text-muted">
            Die Uhr läuft ab dem Start. Du kannst zwischen den Aufgaben springen; bewertet wird erst bei der Abgabe.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={assemble} className="btn-primary btn-lg">
              Klausur starten
            </button>
            <Link href="/klausur" className="btn-secondary">
              Zurück
            </Link>
          </div>

          {previous.length > 0 && (
            <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
              Bisher {previous.length}× geschrieben, bestes Ergebnis{' '}
              <span className="tabnum font-medium text-ink">
                {Math.round(Math.max(...previous.map((p) => (p.max ? p.total / p.max : 0))) * 100)} %
              </span>
              .
            </p>
          )}
        </div>
      </Page>
    )
  }

  if (phase === 'grading' || !slots) {
    return (
      <Page title={exam.title}>
        <div className="flex items-center gap-3 px-1 py-14 text-[14px] text-muted">
          <Spinner /> Klausur wird ausgewertet — Programmieraufgaben werden dafür ausgeführt …
        </div>
      </Page>
    )
  }

  if (phase === 'result' && attempt) {
    return <ExamResult exam={exam} slots={slots} attempt={attempt} results={results} answers={answers} onRetry={assemble} />
  }

  /* ------------------------------ Laufend ------------------------------ */

  const slot = slots[cursor]
  const mins = Math.max(0, Math.floor(remaining / 60000))
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000))
  const urgent = remaining < 5 * 60_000

  return (
    <div className="mx-auto w-full max-w-content px-4 py-5 sm:px-7 sm:py-6">
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-7 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[14px] font-medium">{exam.title}</span>
          <span className={`tabnum text-[15px] font-semibold ${urgent ? 'text-bad' : ''}`}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="tabnum text-[13px] text-muted">
            Aufgabe {cursor + 1} von {slots.length}
          </span>
          <button onClick={() => setConfirmOpen(true)} className="btn-primary btn-sm ml-auto">
            Abgeben
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {slots.map((s, i) => {
            const done = hasAnswer(answers[s.exercise.id])
            return (
              <button
                key={s.exercise.id}
                onClick={() => setCursor(i)}
                title={`${s.task.label} — ${s.exercise.title}`}
                className={`h-1.5 flex-1 min-w-[10px] rounded-full transition-colors ${
                  i === cursor ? 'bg-accent' : done ? 'bg-ok/60' : 'bg-line'
                }`}
                aria-label={`Zu Aufgabe ${i + 1}`}
              />
            )
          })}
        </div>
      </div>

      <div className="mb-4">
        <div className="eyebrow">
          {slot.task.label} — {slot.task.title} · {slot.task.points} Punkte
        </div>
        {slot.task.instructions && (
          <Markdown className="mt-1.5 max-w-prose !text-[13.5px] text-muted">{slot.task.instructions}</Markdown>
        )}
      </div>

      <ExerciseView
        key={slot.exercise.id}
        exercise={slot.exercise}
        examMode
        position={cursor}
        total={slots.length}
        onDone={() => setCursor((c) => Math.min(slots.length - 1, c + 1))}
        onAnswerChange={(a) => setAnswers((prev) => ({ ...prev, [slot.exercise.id]: a }))}
      />

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <button onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0} className="btn-secondary">
          ← Zurück
        </button>
        {cursor < slots.length - 1 ? (
          <button onClick={() => setCursor((c) => c + 1)} className="btn-secondary">
            Weiter →
          </button>
        ) : (
          <button onClick={() => setConfirmOpen(true)} className="btn-primary">
            Klausur abgeben
          </button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Klausur abgeben?"
        footer={
          <>
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary">
              Weiter bearbeiten
            </button>
            <button onClick={submit} className="btn-primary">
              Abgeben
            </button>
          </>
        }
      >
        <p className="text-[14px]">
          {slots.filter((s) => !hasAnswer(answers[s.exercise.id])).length} von {slots.length} Aufgaben sind noch
          unbearbeitet. Nach der Abgabe siehst du die Auswertung und alle Musterlösungen.
        </p>
      </Dialog>
    </div>
  )
}

/* ---------------------------- Auswertung ---------------------------- */

function ExamResult({
  exam,
  slots,
  attempt,
  results,
  answers,
  onRetry,
}: {
  exam: Exam
  slots: Slot[]
  attempt: ExamAttempt
  results: Record<string, GradeResult>
  answers: Record<string, unknown>
  onRetry: () => void
}) {
  const pct = attempt.max > 0 ? (attempt.total / attempt.max) * 100 : 0
  const passed = pct >= 50
  const byTask = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      if (!map.has(s.task.id)) map.set(s.task.id, [])
      map.get(s.task.id)!.push(s)
    }
    return [...map.entries()]
  }, [slots])

  return (
    <Page title="Auswertung" lead={exam.title}>
      <section className="panel px-5 py-5">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div className="eyebrow">Ergebnis</div>
            <div className="tabnum mt-1 text-[38px] font-semibold leading-none">
              {Math.round(attempt.total * 10) / 10}
              <span className="text-[18px] font-normal text-muted"> / {attempt.max} P</span>
            </div>
          </div>
          <div>
            <div className="eyebrow">Prozent</div>
            <div className={`tabnum mt-1 text-[38px] font-semibold leading-none ${passed ? 'text-ok' : 'text-bad'}`}>
              {Math.round(pct)}%
            </div>
          </div>
          <div>
            <div className="eyebrow">Note</div>
            <div className="tabnum mt-1 text-[38px] font-semibold leading-none">{attempt.grade}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="eyebrow">Zeit</div>
            <div className="tabnum mt-1 text-[20px] font-semibold leading-none">
              {Math.round(attempt.durationMs / 60000)} min
              <span className="text-[13px] font-normal text-muted"> von {exam.minutes}</span>
            </div>
          </div>
        </div>
        <Meter value={pct / 100} tone={passed ? 'ok' : 'bad'} className="mt-5" />
        <p className="mt-2.5 text-[13px] text-muted">
          {passed
            ? 'Bestanden. Die Grenze liegt üblicherweise bei 50 Prozent.'
            : 'Noch nicht bestanden — üblich sind 50 Prozent zum Bestehen.'}{' '}
          Kurzantworten und UML-Aufgaben lassen sich nicht automatisch bewerten und zählen hier mit null Punkten; sieh
          sie dir unten selbst an.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-[15px] font-semibold">Nach Aufgaben</h2>
        <table className="w-full border-collapse text-[13.5px]">
          <tbody>
            {byTask.map(([taskId, list]) => {
              const got = attempt.scores[taskId] ?? 0
              const max = attempt.maxScores[taskId] ?? list[0].task.points
              const ratio = max ? got / max : 0
              return (
                <tr key={taskId} className="border-b border-line">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium">
                      {list[0].task.label} — {list[0].task.title}
                    </div>
                    <div className="text-[12.5px] text-muted">{list.length} Teilaufgaben</div>
                  </td>
                  <td className="w-[180px] py-2.5 pr-3">
                    <Meter value={ratio} tone={ratio >= 0.75 ? 'ok' : ratio >= 0.4 ? 'warn' : 'bad'} />
                  </td>
                  <td className="w-[110px] py-2.5 text-right tabnum">
                    {Math.round(got * 10) / 10} / {Math.round(max * 10) / 10} P
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold">Alle Aufgaben durchgehen</h2>
        <ul className="space-y-6">
          {slots.map((s) => {
            const r = results[s.exercise.id]
            return (
              <li key={s.exercise.id} className="border-t border-line pt-5">
                <div className="mb-2 flex flex-wrap items-baseline gap-3 text-[13px]">
                  <span className="eyebrow">{s.task.label}</span>
                  <span
                    className={`font-medium ${
                      r?.correct ? 'text-ok' : r?.needsSelfCheck ? 'text-muted' : 'text-bad'
                    }`}
                  >
                    {r?.correct ? 'richtig' : r?.needsSelfCheck ? 'selbst prüfen' : 'nicht richtig'}
                  </span>
                  <span className="tabnum text-muted">
                    {Math.round((r?.score ?? 0) * s.points * 10) / 10} / {Math.round(s.points * 10) / 10} P
                  </span>
                </div>
                <ReviewItem exercise={s.exercise} answer={answers[s.exercise.id]} />
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
        <button onClick={onRetry} className="btn-primary">
          Neue Variante schreiben
        </button>
        <Link href="/klausur" className="btn-secondary">
          Andere Klausur
        </Link>
        <Link href="/ueben?modus=mistakes" className="btn-secondary">
          Fehler gezielt nacharbeiten
        </Link>
      </div>
    </Page>
  )
}

function ReviewItem({ exercise, answer }: { exercise: Exercise; answer: unknown }) {
  return (
    <div>
      <div className="text-[14.5px] font-medium">{exercise.title}</div>
      <Markdown className="mt-1 !text-[13.5px]">{exercise.prompt}</Markdown>
      {exercise.code && <CodeBlock code={exercise.code} language={exercise.lang} maxHeight={320} />}
      <div className="mt-2 overflow-hidden rounded-md border border-line">
        <div className="border-b border-line bg-sunken px-3 py-1.5">
          <span className="eyebrow">Deine Antwort</span>
        </div>
        <pre className="whitespace-pre-wrap break-words bg-surface px-3 py-2 font-mono text-[12.5px]">
          {formatAnswer(exercise, answer) || <span className="text-faint">nicht bearbeitet</span>}
        </pre>
      </div>
      <div className="mt-2">
        <Solution exercise={exercise} open={false} />
      </div>
    </div>
  )
}

function formatAnswer(ex: Exercise, a: unknown): string {
  if (a === undefined || a === null || a === '') return ''
  if (Array.isArray(a)) {
    return a
      .map((id) => ex.choices?.find((c) => c.id === id)?.text ?? String(id))
      .join('\n')
  }
  if (typeof a === 'object') {
    return Object.entries(a as Record<string, string>)
      .map(([k, v]) => `Lücke ${k}: ${v}`)
      .join('\n')
  }
  if (ex.type === 'mc') return ex.choices?.find((c) => c.id === a)?.text ?? String(a)
  return String(a)
}

function hasAnswer(a: unknown): boolean {
  if (a === undefined || a === null) return false
  if (typeof a === 'string') return a.trim().length > 0
  if (Array.isArray(a)) return a.length > 0
  if (typeof a === 'object') return Object.values(a as Record<string, string>).some((v) => String(v).trim())
  return true
}

/** Zieht Aufgaben nach Bauplan aus der Bank — bei jedem Start neu gemischt. */
function drawFromBank(bp: TaskBlueprint, pool: ExerciseMeta[], exclude: string[]): ExerciseMeta[] {
  const types = bp.type ? (Array.isArray(bp.type) ? bp.type : [bp.type]) : null
  const used = new Set(exclude)
  const candidates = pool.filter(
    (m) =>
      bp.topicIds.includes(m.topicId) &&
      !used.has(m.id) &&
      (!types || types.includes(m.type)) &&
      (!bp.minDifficulty || m.difficulty >= bp.minDifficulty) &&
      (!bp.maxDifficulty || m.difficulty <= bp.maxDifficulty) &&
      (!bp.examStyleOnly || m.examStyle),
  )

  /* Klausurformat bevorzugen, sonst zufällig — damit jede Variante anders aussieht. */
  const shuffled = candidates
    .map((m) => ({ m, r: Math.random() - (m.examStyle ? 0.35 : 0) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.m)

  /* über die Themen des Bauplans streuen */
  const out: ExerciseMeta[] = []
  const perTopic = new Map<string, number>()
  const cap = Math.max(1, Math.ceil(bp.count / Math.max(1, bp.topicIds.length)))
  for (const m of shuffled) {
    if (out.length >= bp.count) break
    const n = perTopic.get(m.topicId) ?? 0
    if (n >= cap) continue
    perTopic.set(m.topicId, n + 1)
    out.push(m)
  }
  for (const m of shuffled) {
    if (out.length >= bp.count) break
    if (!out.includes(m)) out.push(m)
  }
  return out
}
