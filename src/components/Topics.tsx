'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { JAVA_TOPICS, PY_TOPICS, RELEVANCE_LABEL, TOPIC_BY_ID } from '@/content/topics'
import type { Topic } from '@/lib/types'
import { useStore } from '@/lib/store'
import { Loading, Meter, Segmented } from './ui'
import { Page } from './Shell'

export function Topics() {
  const { ready, index, mastery } = useStore()
  const [lang, setLang] = useState<'both' | 'python' | 'java'>('both')

  const groups = useMemo(() => {
    const out: { title: string; topics: Topic[] }[] = []
    if (lang !== 'java') out.push({ title: 'Python & funktionale Programmierung', topics: PY_TOPICS })
    if (lang !== 'python') out.push({ title: 'Java & objektorientierte Programmierung', topics: JAVA_TOPICS })
    return out
  }, [lang])

  if (!ready || !index) {
    return (
      <Page title="Themen">
        <Loading />
      </Page>
    )
  }

  return (
    <Page
      title="Themen"
      lead="Die vollständige Landkarte des Stoffs. Der Balken zeigt, wie sicher du das Thema aktuell beherrschst."
      actions={
        <Segmented
          value={lang}
          onChange={setLang}
          options={[
            { value: 'both', label: 'Alle' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
          ]}
        />
      }
    >
      <div className="space-y-9">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-[15px] font-semibold">{g.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {g.topics.map((t) => {
                const m = mastery[t.id]
                return (
                  <li key={t.id}>
                    <Link
                      href={`/themen/${t.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-sunken sm:flex-nowrap"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14.5px] font-medium">{t.title}</span>
                          {t.relevance !== 'core' && (
                            <span
                              className={`tag ${t.relevance === 'low' ? '' : 'tag-warn'}`}
                              title={RELEVANCE_LABEL[t.relevance]?.hint}
                            >
                              {RELEVANCE_LABEL[t.relevance]?.label ?? t.relevance}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-muted">{t.lecture}</div>
                      </div>

                      <div className="flex w-full items-center gap-3 sm:w-[280px]">
                        <Meter
                          value={m?.mastery ?? 0}
                          tone={
                            !m || m.seen === 0 ? 'accent' : m.mastery >= 0.75 ? 'ok' : m.mastery >= 0.4 ? 'warn' : 'bad'
                          }
                        />
                        <span className="tabnum w-9 shrink-0 text-right text-[13px] text-muted">
                          {m?.seen ? `${Math.round(m.mastery * 100)}%` : '—'}
                        </span>
                        <span className="tabnum w-16 shrink-0 text-right text-[12.5px] text-faint">
                          {m?.seen ?? 0}/{m?.total ?? 0}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  )
}

export function topicTitle(id: string) {
  return TOPIC_BY_ID[id]?.title ?? id
}
