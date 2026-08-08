'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { JAVA_TOPICS, PY_TOPICS, RELEVANCE_LABEL, TOPICS, examWeight } from '@/content/topics'
import type { Topic } from '@/lib/types'
import { useStore } from '@/lib/store'
import { EASE, Loading, Reveal, Segmented } from './ui'
import { Meter, TopicMap, toneFor, type TopicTile } from './viz'
import { shortTitle } from './Home'
import { Page } from './Shell'

export function Topics() {
  const { ready, index, mastery } = useStore()
  const [lang, setLang] = useState<'both' | 'python' | 'java'>('both')
  const [view, setView] = useState<'karte' | 'liste'>('karte')

  const tiles: TopicTile[] = useMemo(
    () =>
      TOPICS.filter((t) => lang === 'both' || t.lang === lang).map((t) => {
        const m = mastery[t.id]
        return {
          id: t.id,
          title: t.title,
          short: shortTitle(t.title),
          lang: t.lang,
          weight: examWeight(t.id),
          mastery: m?.mastery ?? 0,
          seen: m?.seen ?? 0,
          total: m?.total ?? 0,
        }
      }),
    [mastery, lang],
  )

  const groups = useMemo(() => {
    const out: { title: string; topics: Topic[] }[] = []
    if (lang !== 'java') out.push({ title: 'Python & funktionale Programmierung', topics: PY_TOPICS })
    if (lang !== 'python') out.push({ title: 'Java & objektorientierte Programmierung', topics: JAVA_TOPICS })
    return out
  }, [lang])

  if (!ready || !index) {
    return (
      <Page title="Themen">
        <Loading lines={5} />
      </Page>
    )
  }

  return (
    <Page
      title="Themen"
      lead="Die vollständige Landkarte des Stoffs. In der Kartenansicht entspricht die Fläche eines Feldes seinem Punktegewicht in der Klausur."
      actions={
        <>
          <Segmented
            name="topics-view"
            value={view}
            onChange={setView}
            options={[
              { value: 'karte', label: 'Karte' },
              { value: 'liste', label: 'Liste' },
            ]}
          />
          <Segmented
            name="topics-lang"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'both', label: 'Alle' },
              { value: 'python', label: 'Python' },
              { value: 'java', label: 'Java' },
            ]}
          />
        </>
      }
    >
      {view === 'karte' ? (
        <motion.div
          key="karte"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <TopicMap tiles={tiles} href={(id) => `/themen/${id}`} />
          <p className="mt-4 text-[12.5px] text-faint">
            Ein blasses großes Feld bedeutet: viele Klausurpunkte, wenig Sicherheit. Genau dort lohnt sich die
            nächste Stunde am meisten.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-10">
          {groups.map((g, gi) => (
            <Reveal key={g.title} index={gi}>
              <section>
                <h2 className="mb-3 text-[19px]">{g.title}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {g.topics.map((t, i) => {
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
                              tone={toneFor(m?.mastery ?? 0, (m?.seen ?? 0) > 0)}
                              delay={i * 0.03}
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
            </Reveal>
          ))}
        </div>
      )}
    </Page>
  )
}
