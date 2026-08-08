'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { RELEVANCE_LABEL, TOPIC_BY_ID, TOPICS } from '@/content/topics'
import type { Exercise } from '@/lib/types'
import { loadTheory, loadTopicExercises } from '@/lib/content'
import { useStore } from '@/lib/store'
import { ExerciseView } from './Exercise'
import { Markdown } from './Markdown'
import { Loading, Meter, Segmented } from './ui'
import { Page } from './Shell'

type Tab = 'theorie' | 'aufgaben' | 'klausur'

export function TopicDetail({ topicId }: { topicId: string }) {
  const topic = TOPIC_BY_ID[topicId]
  const { mastery, progress, recordAnswer, toggleFlag, index, resetTopic } = useStore()
  const [tab, setTab] = useState<Tab>('theorie')
  const [theory, setTheory] = useState<string | null | undefined>(undefined)
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setTheory(undefined)
    setExercises(null)
    setOpenId(null)
    void loadTheory(topicId).then(setTheory)
    void loadTopicExercises(topicId).then(setExercises)
  }, [topicId])

  if (!topic) {
    return (
      <Page title="Unbekanntes Thema">
        <Link href="/themen" className="btn-secondary">
          Zur Themenübersicht
        </Link>
      </Page>
    )
  }

  const m = mastery[topicId]
  const neighbours = TOPICS.filter((t) => t.lang === topic.lang).sort((a, b) => a.order - b.order)
  const idx = neighbours.findIndex((t) => t.id === topicId)
  const prev = neighbours[idx - 1]
  const next = neighbours[idx + 1]

  return (
    <Page
      title={topic.title}
      lead={topic.summary}
      actions={
        <>
          <Link href={`/ueben?thema=${topicId}`} className="btn-primary">
            Thema üben
          </Link>
        </>
      }
    >
      {/* Kennzahlen */}
      <div className="panel mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="min-w-[150px]">
          <div className="eyebrow">Beherrschung</div>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="tabnum text-[20px] font-semibold leading-none">
              {m?.seen ? `${Math.round(m.mastery * 100)}%` : '—'}
            </span>
            <Meter
              value={m?.mastery ?? 0}
              tone={!m || m.seen === 0 ? 'accent' : m.mastery >= 0.75 ? 'ok' : m.mastery >= 0.4 ? 'warn' : 'bad'}
              className="w-24"
            />
          </div>
        </div>
        <div>
          <div className="eyebrow">Aufgaben</div>
          <div className="tabnum mt-1 text-[20px] font-semibold leading-none">
            {m?.seen ?? 0}
            <span className="text-[14px] font-normal text-muted"> / {m?.total ?? exercises?.length ?? 0}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Vorlesung</div>
          <div className="mt-1 text-[14px]">{topic.lecture}</div>
        </div>
        <div>
          <div className="eyebrow">Klausurrelevanz</div>
          <div className="mt-1 text-[14px]" title={RELEVANCE_LABEL[topic.relevance]?.hint}>
            {RELEVANCE_LABEL[topic.relevance]?.label ?? topic.relevance}
          </div>
        </div>
        {m && m.seen > 0 && (
          <button
            onClick={() => {
              if (confirm(`Alle Ergebnisse zu «${topic.title}» zurücksetzen?`)) resetTopic(topicId)
            }}
            className="btn-quiet ml-auto btn-sm !text-faint"
          >
            Thema zurücksetzen
          </button>
        )}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'theorie', label: 'Theorie' },
          { value: 'aufgaben', label: `Aufgaben${exercises ? ` (${exercises.length})` : ''}` },
          { value: 'klausur', label: 'In der Klausur' },
        ]}
      />

      <div className="mt-5">
        {tab === 'theorie' &&
          (theory === undefined ? (
            <Loading />
          ) : theory ? (
            <div className="max-w-prose">
              <Markdown>{theory}</Markdown>
            </div>
          ) : (
            <p className="text-[14px] text-muted">Für dieses Thema gibt es noch keinen Theorietext.</p>
          ))}

        {tab === 'aufgaben' &&
          (!exercises ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {exercises.map((ex) => {
                const st = progress.items[ex.id]
                const open = openId === ex.id
                return (
                  <li key={ex.id}>
                    <button
                      onClick={() => setOpenId(open ? null : ex.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sunken"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          !st?.reps ? 'bg-line' : st.mastery >= 0.75 ? 'bg-ok' : st.mastery >= 0.4 ? 'bg-warn' : 'bg-bad'
                        }`}
                        title={st?.reps ? `${Math.round(st.mastery * 100)} % beherrscht` : 'noch nicht bearbeitet'}
                      />
                      <span className="min-w-0 flex-1 truncate text-[14px]">{ex.title}</span>
                      <span className="hidden shrink-0 text-[12.5px] text-faint sm:inline">{typeLabel(ex.type)}</span>
                      <span className="tabnum shrink-0 text-[12.5px] text-faint">
                        {'•'.repeat(ex.difficulty)}
                        <span className="text-line">{'•'.repeat(5 - ex.difficulty)}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="enter border-t border-line bg-paper px-4 py-5">
                        <ExerciseView
                          exercise={ex}
                          onDone={(r) => {
                            const meta = index?.items.find((i) => i.id === ex.id)
                            if (meta) recordAnswer(meta, r)
                          }}
                          flagged={progress.items[ex.id]?.flagged}
                          onToggleFlag={() => toggleFlag(ex.id, ex.topicId)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ))}

        {tab === 'klausur' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel px-5 py-4">
              <h3 className="text-[14.5px] font-semibold">Typische Aufgabenformate</h3>
              <ul className="mt-2 space-y-1 text-[13.5px] text-muted">
                {topic.examFormats.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="text-faint">–</span>
                    {f}
                  </li>
                ))}
              </ul>
              {topic.sources?.length ? (
                <>
                  <h3 className="mt-5 text-[14.5px] font-semibold">Quellen</h3>
                  <ul className="mt-2 space-y-1 text-[13px] text-muted">
                    {topic.sources.map((s, i) => (
                      <li key={i}>
                        {s.file}
                        {s.page ? `, S. ${s.page}` : ''}
                        {s.label ? ` — ${s.label}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <section className="panel px-5 py-4">
              <h3 className="text-[14.5px] font-semibold">Das musst du können</h3>
              <ul className="mt-3 space-y-4">
                {topic.subtopics.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium">{s.title}</span>
                      {s.relevance !== 'core' && (
                        <span className="tag">{RELEVANCE_LABEL[s.relevance]?.label ?? s.relevance}</span>
                      )}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {s.points.map((p, i) => (
                        <li key={i} className="flex gap-2 text-[13.5px] text-muted">
                          <span aria-hidden className="text-faint">·</span>
                          <Markdown className="!text-[13.5px] [&>p]:!my-0">{p}</Markdown>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>

      <nav className="mt-10 flex items-center justify-between border-t border-line pt-4 text-[13.5px]">
        {prev ? (
          <Link href={`/themen/${prev.id}`} className="text-accent hover:underline">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/themen/${next.id}`} className="text-accent hover:underline">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </Page>
  )
}

function typeLabel(t: string): string {
  return (
    {
      code: 'Programmieren',
      'predict-output': 'Ausgabe vorhersagen',
      'fill-gaps': 'Lücken füllen',
      mc: 'Multiple Choice',
      'multi-mc': 'Mehrfachauswahl',
      'short-answer': 'Kurzantwort',
      'find-errors': 'Fehlersuche',
      uml: 'UML',
    }[t] ?? t
  )
}
