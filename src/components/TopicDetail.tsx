'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { RELEVANCE_LABEL, TOPIC_BY_ID, TOPICS, examWeight } from '@/content/topics'
import type { Exercise } from '@/lib/types'
import { loadTheory, loadTopicExercises } from '@/lib/content'
import { useStore } from '@/lib/store'
import { EXAM_POINTS, GATE_MASTERY } from '@/lib/curriculum'
import { ExerciseView } from './Exercise'
import { Markdown, headings } from './Markdown'
import { Loading, SectionHead, Segmented } from './ui'
import { Meter, toneFor } from './viz'
import { SourceLink } from './Sources'
import { Page } from './Shell'

/* ==================================================================== *
 *  Themenseite
 *
 *  Drei Ansichten auf dasselbe Kapitel: der Text, die Aufgaben, und
 *  was davon in der Klausur tatsächlich abgefragt wird.
 *
 *  Am Ende des Textes steht bewusst KEIN „weiter lesen", sondern eine
 *  Übungsrunde: Lesen allein erzeugt ein Vertrautheitsgefühl, das mit
 *  Können leicht verwechselt wird. Erst der Abruf zeigt den Unterschied.
 * ==================================================================== */

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

  const toc = useMemo(() => (theory ? headings(theory) : []), [theory])

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
  const points = Math.round(examWeight(topicId) * EXAM_POINTS)
  const neighbours = TOPICS.filter((t) => t.lang === topic.lang).sort((a, b) => a.order - b.order)
  const idx = neighbours.findIndex((t) => t.id === topicId)
  const prev = neighbours[idx - 1]
  const next = neighbours[idx + 1]
  const sits = (m?.mastery ?? 0) >= GATE_MASTERY

  return (
    <Page
      eyebrow={`Lektion ${topic.order} von ${TOPICS.length} · ${topic.lang === 'python' ? 'Python' : 'Java'}`}
      title={topic.title}
      lead={topic.summary}
      width="wide"
      actions={
        <Link href={`/ueben?thema=${topicId}`} className="btn-primary">
          Thema üben
        </Link>
      }
      meta={[
        {
          label: 'Beherrschung',
          value: (
            <span className="flex items-center gap-2.5">
              <span className={sits ? 'text-pos' : ''}>{m?.seen ? `${Math.round(m.mastery * 100)} %` : '—'}</span>
              <Meter value={m?.mastery ?? 0} tone={toneFor(m?.mastery ?? 0, (m?.seen ?? 0) > 0)} className="w-20" />
            </span>
          ),
        },
        { label: 'Aufgaben', value: `${m?.seen ?? 0} / ${m?.total ?? exercises?.length ?? 0}` },
        { label: 'Klausurpunkte', value: `≈ ${points} von ${EXAM_POINTS}` },
        { label: 'Vorlesung', value: topic.lecture },
        {
          label: 'Relevanz',
          value: RELEVANCE_LABEL[topic.relevance]?.label ?? topic.relevance,
        },
      ]}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'theorie', label: 'Theorie' },
            { value: 'aufgaben', label: `Aufgaben${exercises ? ` (${exercises.length})` : ''}` },
            { value: 'klausur', label: 'In der Klausur' },
          ]}
        />
        {m && m.seen > 0 && (
          <button
            onClick={() => {
              if (confirm(`Alle Ergebnisse zu «${topic.title}» zurücksetzen?`)) resetTopic(topicId)
            }}
            className="btn-quiet btn-sm ml-auto !text-faint"
          >
            Thema zurücksetzen
          </button>
        )}
      </div>

      <div className="mt-7">
        {/* ------------------------------ Theorie ------------------------------ */}
        {tab === 'theorie' &&
          (theory === undefined ? (
            <Loading />
          ) : theory ? (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_212px]">
              <div className="min-w-0 max-w-prose">
                <Markdown>{theory}</Markdown>

                {/* Abruf direkt nach dem Lesen — das ist der Punkt, an dem
                    aus Vertrautheit Wissen wird. */}
                <div className="mt-12 rounded-md border-l-2 border-l-accent border-y border-r border-rule bg-surface px-5 py-5">
                  <div className="eyebrow !text-accent">Jetzt abrufen</div>
                  <p className="pretty mt-2 text-[14px] leading-relaxed text-ink">
                    Gelesen zu haben fühlt sich an wie Können — ist es aber nicht. Zehn Aufgaben zu diesem Kapitel
                    zeigen dir in fünf Minuten, was wirklich hängen geblieben ist.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/ueben?thema=${topicId}&laenge=10`} className="btn-primary">
                      Zehn Aufgaben starten
                    </Link>
                    <button onClick={() => setTab('klausur')} className="btn-secondary">
                      Was davon geprüft wird
                    </button>
                  </div>
                </div>
              </div>

              {/* Inhaltsverzeichnis */}
              {toc.length > 2 && (
                <nav aria-label="Inhalt dieses Kapitels" className="hidden lg:block">
                  <div className="sticky top-8">
                    <div className="eyebrow border-b border-rule pb-2">Inhalt</div>
                    <ul className="mt-3 space-y-1.5">
                      {toc.map((h) => (
                        <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
                          <a
                            href={`#${h.id}`}
                            className={`block leading-snug transition-colors hover:text-accent ${
                              h.level === 2 ? 'text-[12.5px] text-muted' : 'text-[12px] text-faint'
                            }`}
                          >
                            {h.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </nav>
              )}
            </div>
          ) : (
            <p className="text-[14px] text-muted">Für dieses Thema gibt es noch keinen Theorietext.</p>
          ))}

        {/* ------------------------------ Aufgaben ------------------------------ */}
        {tab === 'aufgaben' &&
          (!exercises ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-surface">
              {exercises.map((ex) => {
                const st = progress.items[ex.id]
                const open = openId === ex.id
                return (
                  <li key={ex.id}>
                    <button
                      onClick={() => setOpenId(open ? null : ex.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-[1px] ${
                          !st?.reps
                            ? 'bg-rule'
                            : st.mastery >= 0.75
                              ? 'bg-pos'
                              : st.mastery >= 0.4
                                ? 'bg-oxide'
                                : 'bg-neg'
                        }`}
                        title={st?.reps ? `${Math.round(st.mastery * 100)} % beherrscht` : 'noch nicht bearbeitet'}
                      />
                      <span className="min-w-0 flex-1 truncate text-[14px]">{ex.title}</span>
                      <span className="hidden shrink-0 font-mono text-[10.5px] uppercase tracking-[0.07em] text-faint sm:inline">
                        {typeLabel(ex.type)}
                      </span>
                      <span className="flex shrink-0 gap-[3px]" title={`Schwierigkeit ${ex.difficulty} von 5`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <span
                            key={i}
                            className={`h-1 w-1 rounded-full ${i <= ex.difficulty ? 'bg-accent' : 'bg-rule'}`}
                          />
                        ))}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-rule bg-canvas px-4 py-5">
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

        {/* ---------------------------- In der Klausur ---------------------------- */}
        {tab === 'klausur' && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section>
              <SectionHead title="Das musst du können" as="h3" />
              <ol className="space-y-6">
                {topic.subtopics.map((s, i) => (
                  <li key={s.id} className="grid grid-cols-[28px_1fr] gap-x-3">
                    <span className="pt-[3px] font-mono text-[11px] tabular-nums text-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-medium">{s.title}</span>
                        {s.relevance !== 'core' && (
                          <span className="tag">{RELEVANCE_LABEL[s.relevance]?.label ?? s.relevance}</span>
                        )}
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {s.points.map((p, k) => (
                          <li key={k} className="flex gap-2 text-[13.5px] text-muted">
                            <span aria-hidden className="mt-[9px] h-[4px] w-[4px] shrink-0 rounded-[1px] bg-rule" />
                            <Markdown className="!text-[13.5px] [&>p]:!my-0">{p}</Markdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="space-y-10">
              <section>
                <SectionHead title="Typische Aufgabenformate" as="h3" />
                <ul className="space-y-2">
                  {topic.examFormats.map((f) => (
                    <li key={f} className="rounded-md border border-rule bg-surface px-3.5 py-2.5 text-[13.5px]">
                      {f}
                    </li>
                  ))}
                </ul>
              </section>

              {topic.sources?.length ? (
                <section>
                  <SectionHead title="Nachlesen" as="h3" />
                  <ul className="space-y-2">
                    {topic.sources.map((s, i) => (
                      <li key={i} className="leading-relaxed">
                        <SourceLink source={s} />
                        {s.label ? <span className="ml-2 text-[12px] text-faint">{s.label}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {topic.prereqs?.length ? (
                <section>
                  <SectionHead title="Setzt voraus" as="h3" />
                  <ul className="flex flex-wrap gap-2">
                    {topic.prereqs.map((p) => (
                      <li key={p}>
                        <Link href={`/themen/${p}`} className="tag hover:border-ruleStrong">
                          {TOPIC_BY_ID[p]?.title ?? p}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <nav className="mt-14 flex items-center justify-between gap-4 border-t border-rule pt-5 text-[13.5px]">
        {prev ? (
          <Link href={`/themen/${prev.id}`} className="group min-w-0">
            <span className="eyebrow block">Vorherige Lektion</span>
            <span className="mt-1 block truncate text-accent group-hover:underline">← {prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/themen/${next.id}`} className="group min-w-0 text-right">
            <span className="eyebrow block">Nächste Lektion</span>
            <span className="mt-1 block truncate text-accent group-hover:underline">{next.title} →</span>
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
