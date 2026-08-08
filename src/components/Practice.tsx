'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Exercise, ExerciseMeta } from '@/lib/types'
import { TOPIC_BY_ID } from '@/content/topics'
import { pickExercises, type PickOptions } from '@/lib/mastery'
import { loadExercises, prefetchTopics } from '@/lib/content'
import { useStore } from '@/lib/store'
import { ExerciseView, type ExerciseResult } from './Exercise'
import { AnimatedNumber, EASE, Loading, Reveal } from './ui'
import { Meter, Ring, toneFor } from './viz'
import { Page } from './Shell'

type Mode = PickOptions['mode']

const MODE_LABEL: Record<string, { title: string; lead: string }> = {
  adaptive: {
    title: 'Übungsrunde',
    lead: 'Die Aufgaben werden nach Fälligkeit, Klausurgewicht und deinem aktuellen Stand ausgewählt.',
  },
  due: { title: 'Wiederholung', lead: 'Aufgaben, deren Wissen laut Vergessenskurve gerade zu verblassen beginnt.' },
  weakest: { title: 'Schwächste Themen', lead: 'Konzentriert auf die vier Themen mit dem größten Rückstand.' },
  new: { title: 'Neue Aufgaben', lead: 'Aufgaben, die du noch nie bearbeitet hast.' },
  mistakes: { title: 'Fehler nacharbeiten', lead: 'Aufgaben, bei denen du zuletzt danebenlagst oder die du markiert hast.' },
  exam: { title: 'Klausurformat', lead: 'Nur Aufgaben in der Form, in der sie in der Klausur vorkommen.' },
  topic: { title: 'Thema üben', lead: '' },
}

export function Practice() {
  const params = useSearchParams()
  const router = useRouter()
  const { ready, index, progress, recordAnswer, toggleFlag } = useStore()

  const mode = (params.get('modus') ?? 'adaptive') as Mode
  const topicId = params.get('thema') ?? undefined
  const langParam = params.get('sprache') as 'python' | 'java' | null

  const [queue, setQueue] = useState<Exercise[] | null>(null)
  const [pos, setPos] = useState(0)
  const [scores, setScores] = useState<{ meta: ExerciseMeta; score: number; ms: number }[]>([])
  const [loading, setLoading] = useState(false)
  const buildKey = useRef('')

  const count = progress.settings.sessionLength
  const focus = progress.settings.focus
  const lang: 'python' | 'java' | 'both' = langParam ?? (focus === 'python' || focus === 'java' ? focus : 'both')

  const build = useCallback(async () => {
    if (!index) return
    setLoading(true)
    const picked = pickExercises(progress, index.items, {
      count,
      mode: topicId ? 'topic' : mode,
      lang,
      topicIds: topicId ? [topicId] : undefined,
    })
    const full = await loadExercises(picked)
    setQueue(full)
    setPos(0)
    setScores([])
    setLoading(false)
    prefetchTopics([...new Set(picked.map((p) => p.topicId))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mode, topicId, lang, count])

  useEffect(() => {
    if (!ready || !index) return
    const key = `${mode}|${topicId ?? ''}|${lang}|${count}`
    if (buildKey.current === key) return
    buildKey.current = key
    void build()
  }, [ready, index, mode, topicId, lang, count, build])

  const current = queue?.[pos]
  const done = queue && pos >= queue.length

  const onDone = useCallback(
    (r: ExerciseResult) => {
      if (!current || !index) return
      const meta = index.items.find((i) => i.id === current.id)
      if (meta) {
        recordAnswer(meta, r)
        /* Doppelte Wertung derselben Aufgabe ausschließen — sonst stünde
           sie zweimal im Rundenverlauf. */
        setScores((s) => (s.some((x) => x.meta.id === meta.id) ? s : [...s, { meta, score: r.score, ms: r.ms }]))
      }
      setPos((p) => p + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [current, index, recordAnswer],
  )

  const onSkip = useCallback(() => {
    setPos((p) => p + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const label = topicId
    ? { title: TOPIC_BY_ID[topicId]?.title ?? 'Thema üben', lead: TOPIC_BY_ID[topicId]?.summary ?? '' }
    : (MODE_LABEL[mode] ?? MODE_LABEL.adaptive)

  if (!ready || loading || !queue) {
    return (
      <Page title={label.title} lead={label.lead}>
        <Loading label="Aufgaben werden zusammengestellt …" lines={4} />
      </Page>
    )
  }

  if (done) {
    return (
      <Page title="Runde geschafft" lead={`${scores.length} von ${queue.length} Aufgaben bearbeitet.`}>
        <Summary scores={scores} onAgain={() => void build()} />
      </Page>
    )
  }

  if (!current) {
    return (
      <Page title={label.title} lead={label.lead}>
        <div className="panel px-5 py-10 text-center">
          <p className="text-[16px] font-medium">Für diese Auswahl gibt es gerade nichts zu tun.</p>
          <p className="mx-auto mt-2 max-w-prose text-[13.5px] text-muted">
            Das ist ein gutes Zeichen — alles Fällige ist erledigt. Wähle einen anderen Schwerpunkt oder starte eine
            allgemeine Übungsrunde.
          </p>
          <Link href="/ueben" className="btn-primary mt-5">
            Übungsrunde starten
          </Link>
        </div>
      </Page>
    )
  }

  const answered = scores.length
  const right = scores.filter((s) => s.score >= 0.999).length

  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 sm:px-8 sm:py-8">
      {/* Fortschrittsleiste der Runde */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[21px]">{label.title}</h1>
          <div className="ml-auto flex items-center gap-4 text-[12.5px] text-muted">
            {answered > 0 && (
              <span className="tabnum">
                <span className="font-medium text-ok">{right}</span> richtig
              </span>
            )}
            <span className="tabnum">
              {pos} / {queue.length}
            </span>
            <button onClick={() => router.push('/')} className="btn-quiet btn-sm">
              Beenden
            </button>
          </div>
        </div>

        {/* Jede Aufgabe ein Segment: erledigt, aktuell, offen */}
        <div className="mt-3 flex gap-1">
          {queue.map((q, i) => {
            const s = scores.find((x) => x.meta.id === q.id)
            return (
              <motion.span
                key={q.id}
                className={`h-1.5 flex-1 rounded-full ${
                  s ? (s.score >= 0.999 ? 'bg-ok' : s.score > 0 ? 'bg-warn' : 'bg-bad') : i === pos ? 'bg-accent' : 'bg-line'
                }`}
                initial={false}
                animate={{ opacity: i === pos ? 1 : s ? 0.85 : 0.5, scaleY: i === pos ? 1.3 : 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.28, ease: EASE }}
        >
          <ExerciseView
            exercise={current}
            position={pos}
            total={queue.length}
            onDone={onDone}
            onSkip={onSkip}
            flagged={progress.items[current.id]?.flagged}
            onToggleFlag={() => toggleFlag(current.id, current.topicId)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Summary({
  scores,
  onAgain,
}: {
  scores: { meta: ExerciseMeta; score: number; ms: number }[]
  onAgain: () => void
}) {
  const total = scores.length
  const correct = scores.filter((s) => s.score >= 0.999).length
  const points = scores.reduce((a, s) => a + s.score * s.meta.points, 0)
  const maxPoints = scores.reduce((a, s) => a + s.meta.points, 0)
  const minutes = Math.max(1, Math.round(scores.reduce((a, s) => a + s.ms, 0) / 60000))
  const quote = maxPoints ? points / maxPoints : 0

  const weakTopics = [
    ...new Map(
      scores
        .filter((s) => s.score < 0.7)
        .map((s) => TOPIC_BY_ID[s.meta.topicId])
        .filter(Boolean)
        .map((t) => [t.id, t]),
    ).values(),
  ]

  if (!total) {
    return (
      <div className="panel px-5 py-6">
        <p className="text-[14px] text-muted">Du hast alle Aufgaben übersprungen.</p>
        <button onClick={onAgain} className="btn-primary mt-4">
          Neue Runde
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <section className="panel flex flex-col items-center gap-8 p-7 sm:flex-row">
          <Ring value={quote} size={150} tone={toneFor(quote)}>
            <div>
              <div className="numeral text-[34px] leading-none">
                <AnimatedNumber value={Math.round(quote * 100)} />
                <span className="text-[19px]">%</span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.09em] text-faint">Quote</div>
            </div>
          </Ring>

          <div className="grid flex-1 grid-cols-3 gap-6">
            <div>
              <div className="eyebrow">Richtig</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={correct} />
                <span className="text-[15px] text-muted"> / {total}</span>
              </div>
            </div>
            <div>
              <div className="eyebrow">Punkte</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={Math.round(points * 10) / 10} decimals={1} />
                <span className="text-[15px] text-muted"> / {maxPoints}</span>
              </div>
            </div>
            <div>
              <div className="eyebrow">Zeit</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={minutes} />
                <span className="text-[15px] text-muted"> min</span>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Jede Aufgabe der Runde auf einen Blick */}
      <Reveal index={1}>
        <section className="panel overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <span className="eyebrow">Verlauf dieser Runde</span>
          </div>
          <ul className="divide-y divide-line">
            {scores.map((s, i) => (
              <motion.li
                key={s.meta.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: i * 0.04 }}
                className="flex items-center gap-3 px-5 py-2.5"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    s.score >= 0.999 ? 'bg-ok' : s.score > 0 ? 'bg-warn' : 'bg-bad'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{s.meta.title}</span>
                <span className={`tag ${s.meta.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                  {s.meta.lang === 'python' ? 'Py' : 'Java'}
                </span>
                <span className="tabnum w-16 shrink-0 text-right text-[12.5px] text-muted">
                  {Math.round(s.score * s.meta.points * 10) / 10} / {s.meta.points} P
                </span>
              </motion.li>
            ))}
          </ul>
        </section>
      </Reveal>

      {weakTopics.length > 0 && (
        <Reveal index={2}>
          <section className="panel px-5 py-4">
            <div className="eyebrow">Das solltest du dir noch einmal ansehen</div>
            <ul className="mt-2.5 space-y-2">
              {weakTopics.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/themen/${t.id}`} className="text-[14.5px] text-accent hover:underline">
                    {t.title}
                  </Link>
                  <span className="text-[13px] text-muted">{t.lecture}</span>
                  <Link href={`/ueben?thema=${t.id}`} className="btn-secondary btn-sm ml-auto">
                    Gezielt üben
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={onAgain} className="btn-primary btn-lg">
          Nächste Runde
        </button>
        <Link href="/" className="btn-secondary">
          Zur Übersicht
        </Link>
      </div>
    </div>
  )
}

export { Meter }
