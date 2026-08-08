'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { EXAM_DATE, TOPICS, TOPIC_BY_ID, examWeight } from '@/content/topics'
import { useStore } from '@/lib/store'
import { PracticeSettings } from './PracticeSettings'
import { AnimatedNumber, EASE, Loading, Reveal, useCountdown } from './ui'
import { Meter, Ring, TopicMap, toneFor, type TopicTile } from './viz'
import { LogoMark } from './Logo'

export function Home() {
  const { ready, isNew, progress, index, loadError, readiness, mastery, todayCount, dueCount } = useStore()
  const left = useCountdown(EXAM_DATE)

  const tiles: TopicTile[] = useMemo(
    () =>
      TOPICS.map((t) => {
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
    [mastery],
  )

  const weakest = useMemo(
    () =>
      Object.values(mastery)
        .filter((m) => TOPIC_BY_ID[m.topicId]?.relevance !== 'low')
        .sort((a, b) => b.riskPoints - a.riskPoints)
        .slice(0, 3),
    [mastery],
  )

  if (loadError) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-8">
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
      <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
        <Loading label="Aufgabenbank wird geladen …" lines={4} />
      </div>
    )
  }

  if (isNew) return <Welcome />

  const goal = progress.settings.dailyGoal
  const dayPct = Math.min(1, todayCount / Math.max(1, goal))
  const enoughData = readiness.coverage >= 8

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 sm:px-8 sm:py-10">
      <Reveal>
        <header className="mb-7">
          <h1 className="text-[30px] leading-[1.15] sm:text-[34px]">
            {greeting()}
            {progress.name ? `, ${progress.name}` : ''}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {left && !left.past ? (
              <>
                Noch <span className="tabnum font-medium text-ink">{left.d} Tage</span> bis zur Klausur am 31. August 2026.
              </>
            ) : (
              'Klausurtermin: 31. August 2026.'
            )}
          </p>
        </header>
      </Reveal>

      {/* ------------------- Ein klarer nächster Schritt ------------------- */}
      <Reveal index={1}>
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-8 p-6 sm:p-7 lg:flex-row lg:items-center">
            <div className="flex justify-center lg:justify-start">
              <Ring
                value={enoughData ? readiness.score / 100 : readiness.coverage / 100}
                size={180}
                tone={enoughData ? toneFor(readiness.score / 100) : 'accent'}
                arcs={
                  enoughData
                    ? [
                        { value: readiness.python / 100, tone: 'py', label: 'Python' },
                        { value: readiness.java / 100, tone: 'java', label: 'Java' },
                      ]
                    : []
                }
              >
                <div>
                  <div className="numeral text-[40px] leading-none">
                    <AnimatedNumber value={enoughData ? readiness.score : readiness.coverage} />
                    <span className="text-[22px]">%</span>
                  </div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-[0.09em] text-faint">
                    {enoughData ? 'Prognose' : 'gesehen'}
                  </div>
                </div>
              </Ring>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-[20px]">Weitermachen</h2>
              <p className="mt-1.5 max-w-prose text-[14.5px] text-muted">
                {dueCount > 0
                  ? `${dueCount} Aufgaben sind zur Wiederholung fällig — die Runde mischt sie mit neuem Stoff.`
                  : todayCount >= goal
                    ? 'Dein Tagesziel steht. Eine weitere Runde schadet trotzdem nicht.'
                    : 'Eine Runde dauert etwa zehn Minuten und stellt sich auf deinen Stand ein.'}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link href="/ueben" className="btn-primary btn-lg">
                  Übungsrunde starten
                </Link>
                {dueCount > 0 && (
                  <Link href="/ueben?modus=due" className="btn-secondary">
                    Nur Wiederholung
                  </Link>
                )}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <PracticeSettings />
              </div>
            </div>

            <div className="w-full shrink-0 border-t border-line pt-5 lg:w-[190px] lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <div className="eyebrow">Heute</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="numeral text-[32px] leading-none">
                  <AnimatedNumber value={todayCount} />
                </span>
                <span className="text-[13.5px] text-muted">von {goal}</span>
              </div>
              <Meter value={dayPct} tone={dayPct >= 1 ? 'ok' : 'brass'} className="mt-3" delay={0.3} />

              <div className="mt-4 flex items-baseline gap-2">
                <span className="numeral text-[22px] leading-none text-brass">
                  <AnimatedNumber value={progress.streak.current} />
                </span>
                <span className="text-[12.5px] text-muted">
                  {progress.streak.current === 1 ? 'Tag in Folge' : 'Tage in Folge'}
                </span>
              </div>
              {progress.streak.best > progress.streak.current && (
                <div className="mt-1 text-[12px] text-faint">Bestwert {progress.streak.best}</div>
              )}
            </div>
          </div>

          {enoughData && (
            <div className="grid grid-cols-2 divide-x divide-line border-t border-line bg-sunken/60 sm:grid-cols-4">
              {[
                { label: 'Python', value: readiness.python, tone: 'text-py' },
                { label: 'Java', value: readiness.java, tone: 'text-java' },
                { label: 'Note', value: readiness.grade, tone: '' },
                { label: 'durch Wiederholen', value: `+${readiness.quickWin}%`, tone: 'text-brass' },
              ].map((s) => (
                <div key={s.label} className="px-5 py-3.5">
                  <div className="eyebrow">{s.label}</div>
                  <div className={`tabnum mt-1 text-[17px] font-semibold ${s.tone}`}>
                    {typeof s.value === 'number' ? `${s.value} %` : s.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* ------------------------- Wo die Punkte liegen ------------------------- */}
      <Reveal index={2} className="mt-9">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[19px]">Wo die Klausurpunkte liegen</h2>
          <span className="text-[13px] text-faint">
            Fläche = Punktegewicht · Füllung = dein Stand
          </span>
          <Link href="/themen" className="ml-auto text-[13.5px] text-accent hover:underline">
            Alle Themen
          </Link>
        </div>
        <TopicMap tiles={tiles} href={(id) => `/themen/${id}`} />
      </Reveal>

      {/* --------------------------- Als Nächstes dran --------------------------- */}
      {weakest.length > 0 && weakest[0].riskPoints > 0.5 && (
        <Reveal index={3} className="mt-9">
          <h2 className="mb-3 text-[19px]">Als Nächstes dran</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {weakest.map((m, i) => {
              const t = TOPIC_BY_ID[m.topicId]
              return (
                <li key={m.topicId}>
                  <Link href={`/ueben?thema=${m.topicId}`} className="panel-link block px-4 py-4">
                    <div className="flex items-start gap-2">
                      <span className={`tag ${t.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                        {t.lang === 'python' ? 'Py' : 'Java'}
                      </span>
                      <span className="tabnum ml-auto text-[12.5px] text-faint">
                        {m.riskPoints.toFixed(1)} P Risiko
                      </span>
                    </div>
                    <div className="mt-2 text-[15px] font-medium leading-snug">{t.title}</div>
                    <Meter
                      value={m.mastery}
                      tone={toneFor(m.mastery, m.seen > 0)}
                      className="mt-3"
                      delay={0.2 + i * 0.08}
                    />
                    <div className="mt-1.5 text-[12px] text-faint">
                      {m.seen} von {m.total} Aufgaben · {m.seen ? `${Math.round(m.mastery * 100)} % sicher` : 'noch nicht begonnen'}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Reveal>
      )}

      {/* ------------------------------ Einstiege ------------------------------ */}
      <Reveal index={4} className="mt-9">
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile href="/klausur" title="Probeklausur schreiben" text="Zwölf Klausuren, davon zehn bei jedem Start neu gezogen." />
          <Tile href="/compiler" title="Compiler öffnen" text="Java und Python ausführen — ohne Installation, direkt hier." />
          <Tile href="/themen" title="Theorie nachlesen" text="Zwanzig Themen mit dem, was wirklich gefragt wird." />
        </div>
      </Reveal>
    </div>
  )
}

function Tile({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="panel-link group block px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-medium">{title}</span>
        <motion.span
          className="text-accent"
          initial={false}
          whileHover={{ x: 3 }}
          aria-hidden
        >
          →
        </motion.span>
      </div>
      <p className="mt-1.5 text-[13px] text-muted">{text}</p>
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

/** Kürzt Themennamen fürs Kartenfeld, ohne sie unkenntlich zu machen. */
export function shortTitle(title: string): string {
  const first = title.split(/\s*[,&:]\s*/)[0].replace(/\s+und\s+.*$/i, '')
  /* Zu knappe Reste („map") sagen nichts mehr — dann lieber den vollen
     Titel nehmen und erst am Ende kürzen. */
  const base = first.length >= 7 ? first : title
  return base.length > 22 ? base.slice(0, 21).trimEnd().replace(/[,&:]$/, '') + '…' : base
}

/* ------------------------- Erster Besuch ------------------------- */

function Welcome() {
  const { setName, setSetting, index, progress } = useStore()
  const [name, setLocalName] = useState(progress.name)
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 py-14 sm:px-8 sm:py-20">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <LogoMark size={44} animate />
        <h1 className="mt-6 text-[34px] leading-[1.1] sm:text-[38px]">Vorbereitung auf die OFP-Klausur</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          {index?.total ?? 528} Aufgaben aus Vorlesung, Übung und den Probeklausuren — dazu ein Java- und
          Python-Compiler, der direkt im Browser läuft.
        </p>
      </motion.div>

      <ul className="mt-9 space-y-5 border-t border-line pt-7">
        {[
          ['Es stellt sich auf dich ein', 'Jede Antwort verschiebt, was du als Nächstes siehst und wann es wiederkommt.'],
          ['Es rechnet in Klausurpunkten', 'Themen werden so gewichtet, wie sie in der Klausur vorkommen.'],
          ['Es bleibt bei dir', 'Der Lernstand liegt in deinem Browser. Kein Konto, kein Passwort, keine Übertragung.'],
        ].map(([t, d], i) => (
          <motion.li
            key={t}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.15 + i * 0.09 }}
            className="flex gap-3.5"
          >
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
            <span>
              <span className="block text-[15px] font-medium">{t}</span>
              <span className="block text-[14px] text-muted">{d}</span>
            </span>
          </motion.li>
        ))}
      </ul>

      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-9 border-t border-line pt-7"
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
      </motion.form>
    </div>
  )
}
