'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { EXAM_DATE, TOPIC_BY_ID } from '@/content/topics'
import { useStore } from '@/lib/store'
import { PracticeSettings } from './PracticeSettings'
import { Loading, Meter, useCountdown } from './ui'
import { LogoMark } from './Logo'

export function Home() {
  const { ready, isNew, progress, index, loadError, readiness, mastery, todayCount, dueCount } = useStore()
  const left = useCountdown(EXAM_DATE)

  const weakest = useMemo(
    () =>
      Object.values(mastery)
        .filter((m) => m.seen > 0 || m.total > 0)
        .filter((m) => TOPIC_BY_ID[m.topicId]?.relevance !== 'low')
        .sort((a, b) => b.riskPoints - a.riskPoints)
        .slice(0, 4),
    [mastery],
  )

  if (loadError) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-7">
        <div className="panel border-bad/35 bg-badWash px-5 py-4">
          <p className="font-medium text-bad">Die Aufgaben konnten nicht geladen werden.</p>
          <p className="mt-1 text-[13.5px] text-muted">{loadError}</p>
          <button onClick={() => location.reload()} className="btn-secondary mt-3">
            Neu laden
          </button>
        </div>
      </div>
    )
  }

  if (!ready || !index) {
    return (
      <div className="mx-auto max-w-content px-4 sm:px-7">
        <Loading />
      </div>
    )
  }

  if (isNew) return <Welcome />

  const goal = progress.settings.dailyGoal
  const dayPct = Math.min(1, todayCount / Math.max(1, goal))
  const enoughData = readiness.coverage >= 8

  return (
    <div className="mx-auto w-full max-w-content px-4 py-7 sm:px-7 sm:py-9">
      <header className="mb-7">
        <h1 className="text-[25px] font-semibold tracking-[-0.02em]">
          {greeting()}
          {progress.name ? `, ${progress.name}` : ''}
        </h1>
        <p className="mt-1 text-[14.5px] text-muted">
          {left && !left.past ? (
            <>
              Noch <span className="tabnum font-medium text-ink">{left.d} Tage</span> bis zur Klausur am 31. August 2026.
            </>
          ) : (
            'Klausurtermin: 31. August 2026.'
          )}
        </p>
      </header>

      {/* ---------------- Eine klare nächste Handlung ---------------- */}
      <section className="panel px-5 py-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">Weitermachen</h2>
            <p className="mt-1 max-w-prose text-[14px] text-muted">
              {dueCount > 0
                ? `${dueCount} Aufgaben sind zur Wiederholung fällig. Die Runde mischt sie mit neuem Stoff.`
                : todayCount >= goal
                  ? 'Dein Tagesziel ist erreicht. Eine weitere Runde schadet trotzdem nicht.'
                  : 'Eine Runde dauert etwa zehn Minuten und stellt sich auf deinen Stand ein.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/ueben" className="btn-primary btn-lg">
                Übungsrunde starten
              </Link>
              {dueCount > 0 && (
                <Link href="/ueben?modus=due" className="btn-secondary">
                  Nur Wiederholung
                </Link>
              )}
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <PracticeSettings />
            </div>
          </div>

          <div className="w-full shrink-0 sm:w-[210px]">
            <div className="eyebrow">Heute</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="tabnum text-[30px] font-semibold leading-none">{todayCount}</span>
              <span className="text-[14px] text-muted">von {goal} Aufgaben</span>
            </div>
            <Meter value={dayPct} tone={dayPct >= 1 ? 'ok' : 'accent'} className="mt-2.5" />
            <div className="mt-2.5 text-[12.5px] text-muted">
              {progress.streak.current > 1
                ? `${progress.streak.current} Tage in Folge · Bestwert ${progress.streak.best}`
                : 'Regelmäßigkeit schlägt Länge.'}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Stand ---------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="panel px-5 py-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Klausurprognose</h2>
            <Link href="/fortschritt" className="text-[13px] text-accent hover:underline">
              Details
            </Link>
          </div>

          {enoughData ? (
            <>
              <div className="mt-3 flex items-end gap-4">
                <div>
                  <div className="tabnum text-[38px] font-semibold leading-none">{readiness.score}%</div>
                  <div className="mt-1 text-[12.5px] text-muted">erwartete Punkte am Klausurtag</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="tabnum text-[22px] font-semibold leading-none">{readiness.grade}</div>
                  <div className="mt-1 text-[12.5px] text-muted">Note nach üblichem Schlüssel</div>
                </div>
              </div>
              <Meter
                value={readiness.score / 100}
                tone={readiness.score >= 75 ? 'ok' : readiness.score >= 50 ? 'warn' : 'bad'}
                className="mt-4"
              />
              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Python</dt>
                  <dd className="tabnum font-medium">{readiness.python}%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Java</dt>
                  <dd className="tabnum font-medium">{readiness.java}%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Aufgabenbank gesehen</dt>
                  <dd className="tabnum font-medium">{readiness.coverage}%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">durch Wiederholen zu holen</dt>
                  <dd className="tabnum font-medium">+{readiness.quickWin}%</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-[14px] text-muted">
                Für eine belastbare Prognose fehlen noch Daten. Bearbeite ein paar Runden — ab etwa 40 Aufgaben wird die
                Schätzung aussagekräftig.
              </p>
              <Meter value={readiness.coverage / 8} className="mt-4" />
              <p className="mt-2 text-[12.5px] text-faint">
                {Object.keys(progress.items).length} von {index.total} Aufgaben angefasst
              </p>
            </div>
          )}
        </section>

        <section className="panel px-5 py-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Wo es gerade hakt</h2>
            <Link href="/themen" className="text-[13px] text-accent hover:underline">
              Alle Themen
            </Link>
          </div>
          {weakest.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">Noch keine Auswertung — leg einfach los.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {weakest.map((m) => {
                const t = TOPIC_BY_ID[m.topicId]
                return (
                  <li key={m.topicId}>
                    <div className="flex items-baseline gap-3">
                      <Link href={`/themen/${m.topicId}`} className="text-[14px] font-medium hover:text-accent">
                        {t.title}
                      </Link>
                      <span className={`tag ${t.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                        {t.lang === 'python' ? 'Py' : 'Java'}
                      </span>
                      <span className="tabnum ml-auto text-[13px] text-muted">{Math.round(m.mastery * 100)}%</span>
                    </div>
                    <Meter
                      value={m.mastery}
                      tone={m.mastery >= 0.75 ? 'ok' : m.mastery >= 0.4 ? 'warn' : 'bad'}
                      className="mt-1.5"
                    />
                    <div className="mt-1 text-[12px] text-faint">
                      {m.seen} von {m.total} Aufgaben gesehen
                      {m.due > 0 ? ` · ${m.due} fällig` : ''}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ---------------- Drei ruhige Einstiege ---------------- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Tile
          href="/klausur"
          title="Probeklausur schreiben"
          text="Originalklausuren und beliebig viele neue Varianten unter Zeitdruck."
        />
        <Tile
          href="/compiler"
          title="Compiler öffnen"
          text="Python und Java direkt im Browser ausführen — ohne Installation."
        />
        <Tile
          href="/themen"
          title="Theorie nachlesen"
          text="Zwanzig Themen mit dem, was in der Klausur wirklich gefragt wird."
        />
      </div>
    </div>
  )
}

function Tile({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="panel block px-4 py-4 transition-colors hover:border-lineStrong hover:bg-sunken">
      <div className="text-[14.5px] font-medium">{title}</div>
      <p className="mt-1 text-[13px] text-muted">{text}</p>
    </Link>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Noch wach'
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

/* ------------------------- Erster Besuch ------------------------- */

function Welcome() {
  const { setName, setSetting, index, progress } = useStore()
  const [name, setLocalName] = useState(progress.name)
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-12 sm:px-7 sm:py-20">
      <LogoMark size={38} />
      <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">
        Vorbereitung auf die OFP-Klausur
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {index?.total ?? 528} Aufgaben aus Vorlesung, Übung und den Probeklausuren — dazu ein Python- und
        Java-Compiler, der direkt im Browser läuft.
      </p>

      <ul className="mt-7 space-y-3.5 border-t border-line pt-6">
        {[
          ['Es stellt sich auf dich ein', 'Jede Antwort verschiebt, was du als Nächstes siehst und wann es wiederkommt.'],
          ['Es rechnet in Klausurpunkten', 'Themen werden so gewichtet, wie sie in der Klausur vorkommen.'],
          ['Es bleibt bei dir', 'Der Lernstand liegt in deinem Browser. Kein Konto, kein Passwort, keine Übertragung.'],
        ].map(([t, d]) => (
          <li key={t}>
            <div className="text-[14.5px] font-medium">{t}</div>
            <div className="text-[13.5px] text-muted">{d}</div>
          </li>
        ))}
      </ul>

      <form
        className="mt-7 border-t border-line pt-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) setName(name)
          setSetting('onboarded', true)
          router.push('/ueben')
        }}
      >
        <label className="label" htmlFor="name">
          Wie sollen wir dich nennen? (optional)
        </label>
        <div className="flex gap-2">
          <input
            id="name"
            className="field"
            value={name}
            onChange={(e) => setLocalName(e.target.value)}
            placeholder="Vorname"
            autoComplete="given-name"
            maxLength={40}
          />
          <button type="submit" className="btn-primary btn-lg shrink-0">
            Loslegen
          </button>
        </div>
      </form>
    </div>
  )
}
