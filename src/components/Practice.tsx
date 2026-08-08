'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise, ExerciseMeta } from '@/lib/types'
import { TOPIC_BY_ID } from '@/content/topics'
import { pickExercises, type PickOptions } from '@/lib/mastery'
import { loadExercises, prefetchTopics } from '@/lib/content'
import { useStore } from '@/lib/store'
import { ExerciseView, type ExerciseResult } from './Exercise'
import { Loading, Meter } from './ui'
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
  const store = useStore()
  const { ready, index, progress, recordAnswer, toggleFlag } = store

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
  const lang: 'python' | 'java' | 'both' =
    langParam ?? (focus === 'python' || focus === 'java' ? focus : 'both')

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
        setScores((s) => [...s, { meta, score: r.score, ms: r.ms }])
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
        <Loading label="Aufgaben werden zusammengestellt …" />
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
        <div className="panel px-5 py-8 text-center">
          <p className="text-[15px] font-medium">Für diese Auswahl gibt es gerade nichts zu tun.</p>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Wähle einen anderen Schwerpunkt oder starte eine allgemeine Übungsrunde.
          </p>
          <Link href="/ueben" className="btn-primary mt-4">
            Übungsrunde starten
          </Link>
        </div>
      </Page>
    )
  }

  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 sm:px-7 sm:py-8">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[19px] font-semibold">{label.title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className="tabnum text-[12.5px] text-muted">
              {pos} / {queue.length}
            </span>
            <button onClick={() => router.push('/')} className="btn-quiet btn-sm">
              Beenden
            </button>
          </div>
        </div>
        <Meter value={pos / queue.length} className="mt-2.5" />
      </div>

      <ExerciseView
        key={current.id}
        exercise={current}
        position={pos}
        total={queue.length}
        onDone={onDone}
        onSkip={onSkip}
        flagged={progress.items[current.id]?.flagged}
        onToggleFlag={() => toggleFlag(current.id, current.topicId)}
      />
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
  const minutes = Math.round(scores.reduce((a, s) => a + s.ms, 0) / 60000)

  const weak = scores
    .filter((s) => s.score < 0.7)
    .map((s) => TOPIC_BY_ID[s.meta.topicId])
    .filter(Boolean)

  const weakTopics = [...new Map(weak.map((t) => [t.id, t])).values()]

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
    <div className="space-y-5">
      <div className="panel grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-4">
        <div>
          <div className="eyebrow">Richtig</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {correct}
            <span className="text-[15px] font-normal text-muted"> / {total}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Punkte</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {Math.round(points * 10) / 10}
            <span className="text-[15px] font-normal text-muted"> / {maxPoints}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Quote</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {Math.round((points / Math.max(1, maxPoints)) * 100)}
            <span className="text-[15px] font-normal text-muted"> %</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Zeit</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {minutes}
            <span className="text-[15px] font-normal text-muted"> min</span>
          </div>
        </div>
      </div>

      {weakTopics.length > 0 && (
        <div className="panel px-5 py-4">
          <div className="eyebrow">Das solltest du dir noch einmal ansehen</div>
          <ul className="mt-2 space-y-1.5">
            {weakTopics.map((t) => (
              <li key={t.id}>
                <Link href={`/themen/${t.id}`} className="text-[14px] text-accent hover:underline">
                  {t.title}
                </Link>
                <span className="ml-2 text-[13px] text-muted">{t.lecture}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={onAgain} className="btn-primary">
          Nächste Runde
        </button>
        <Link href="/" className="btn-secondary">
          Zur Übersicht
        </Link>
      </div>
    </div>
  )
}
