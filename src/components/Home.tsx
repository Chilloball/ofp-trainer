'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'motion/react'
import { EXAM_DATE, TOPIC_BY_ID } from '@/content/topics'
import { useStore } from '@/lib/store'
import { BLOCK_LABEL, humanMinutes } from '@/lib/curriculum'
import { AnimatedNumber, Loading, useCountdown } from './ui'
import { DayRibbon, LessonGrid } from './explain'
import { Onboarding } from './Onboarding'

/* ==================================================================== *
 *  STARTSEITE
 *
 *  Vier Fragen, in genau dieser Reihenfolge, und keine fünfte:
 *
 *    1. Was ist jetzt dran?      → groß, mit einem Knopf
 *    2. Was steht heute noch an? → ein Band, drei Zeilen
 *    3. Wie weit bin ich?        → zwanzig Felder, zwei Zahlen
 *    4. Was kommt morgen?        → zwei Zeilen
 *
 *  Alles, was hier NICHT steht, ist Absicht: Themenkarte, Risikoliste
 *  und Punkteverteilung stehen im Lernplan und unter Themen. Wer die
 *  App öffnet, will nicht analysieren, sondern anfangen.
 *
 *  Textregel für diese Seite: höchstens zwei Sätze am Stück. Was länger
 *  ist, gehört hinter ein „Warum das?".
 * ==================================================================== */

export function Home() {
  const { ready, isNew, progress, index, loadError, readiness, mastery, todayCount, plan, next } = useStore()
  const left = useCountdown(EXAM_DATE)
  const [why, setWhy] = useState(false)

  if (loadError) {
    return (
      <div className="mx-auto max-w-content px-4 py-12 sm:px-8">
        <div className="rounded-md border border-neg/35 bg-negSoft px-5 py-4">
          <p className="font-medium text-neg">Die Aufgaben konnten nicht geladen werden.</p>
          <p className="mt-1 text-[13.5px] text-muted">{loadError}</p>
          <button onClick={() => location.reload()} className="btn-secondary mt-3">
            Neu laden
          </button>
        </div>
      </div>
    )
  }

  if (!ready || !index || !plan || !next) {
    return (
      <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
        <Loading label="Lernstand wird geladen …" lines={3} />
      </div>
    )
  }

  if (isNew) return <Onboarding />

  const goal = progress.settings.dailyGoal
  const dayPct = Math.min(1, todayCount / Math.max(1, goal))
  const tomorrow = plan.days[1]
  const dots = plan.lessons.map((l) => ({ id: l.id, title: l.title, status: l.status, lang: l.lang }))

  const risk = Object.values(mastery)
    .filter((m) => TOPIC_BY_ID[m.topicId]?.relevance !== 'low' && m.seen > 0)
    .sort((a, b) => b.riskPoints - a.riskPoints)[0]

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-8 sm:py-11">
      {/* ------------------------------- Kopf ------------------------------- */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[27px] leading-tight sm:text-[31px]">
          {greeting()}
          {progress.name ? `, ${progress.name}` : ''}
        </h1>
        <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-faint">
          {left && !left.past ? `noch ${left.d} Tage` : 'Klausurtermin vorbei'}
        </span>
      </header>

      {/* ------------------------- 1. Was jetzt dran ist ------------------------- */}
      <section className="mt-7 rounded-md border border-rule bg-surface">
        <div className="border-b border-rule px-6 py-7 sm:px-8 sm:py-8">
          <div className="eyebrow text-accent">
            Jetzt · {next.kind === 'fertig' ? 'frei' : BLOCK_LABEL[next.kind]}
          </div>

          <h2 className="mt-3 max-w-[20ch] text-[24px] leading-[1.15] sm:text-[29px]">{next.title}</h2>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href={next.href} className="btn-primary btn-lg">
              {next.kind === 'klausur' ? 'Klausur wählen' : 'Loslegen'}
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 7h9M7.5 3.5 11 7l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span className="font-mono text-[11.5px] tabular-nums text-faint">
              {humanMinutes(next.minutes)}
              {next.count > 0 && ` · ${next.count} Aufgaben`}
            </span>
            <button
              onClick={() => setWhy((v) => !v)}
              aria-expanded={why}
              className="ml-auto text-[12.5px] text-muted underline decoration-rule underline-offset-2 hover:text-ink"
            >
              {why ? 'Ausblenden' : 'Warum das?'}
            </button>
          </div>

          {/* Die Begründung ist da, wenn man sie will — und weg, wenn nicht. */}
          <motion.div
            initial={false}
            animate={{ height: why ? 'auto' : 0, opacity: why ? 1 : 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pretty mt-4 max-w-prose border-t border-rule pt-4 text-[13.5px] leading-relaxed text-muted">
              {next.why}
            </p>
          </motion.div>
        </div>

        {/* --------------------- 2. Was heute sonst noch ansteht --------------------- */}
        <div className="px-6 py-5 sm:px-8">
          <div className="flex items-baseline justify-between gap-4">
            <span className="eyebrow">Heute</span>
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {todayCount} von {goal} · {humanMinutes(plan.today.minutes)}
            </span>
          </div>

          <DayRibbon blocks={plan.today.blocks} className="mt-3" />

          <ul className="mt-3 space-y-1">
            {plan.today.blocks.map((b, i) => (
              <li key={i} className="flex items-baseline gap-2.5 text-[13px]">
                <span
                  className={`mt-[6px] h-[5px] w-[5px] shrink-0 rounded-[1px] ${
                    b.kind === 'lektion'
                      ? 'bg-accent'
                      : b.kind === 'wiederholung'
                        ? 'bg-pos'
                        : b.kind === 'klausur'
                          ? 'bg-ink'
                          : b.kind === 'fehler'
                            ? 'bg-neg'
                            : 'bg-oxide'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{b.title}</span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-faint">
                  {humanMinutes(b.minutes)}
                </span>
              </li>
            ))}
            {plan.today.blocks.length === 0 && <li className="text-[13px] text-faint">Nichts mehr offen.</li>}
          </ul>

          <div className="meter mt-4">
            <span className={dayPct >= 1 ? 'bg-pos' : 'bg-accent'} style={{ width: `${dayPct * 100}%` }} />
          </div>
        </div>
      </section>

      {/* --------------------------- 3. Wie weit bin ich --------------------------- */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-[17px]">Dein Stand</h2>
          <span className="mx-1 hidden h-px flex-1 bg-rule sm:block" />
          <Link href="/fortschritt" className="text-[12.5px] text-accent hover:underline">
            Details
          </Link>
        </div>

        <div className="grid gap-6 rounded-md border border-rule bg-surface px-6 py-6 sm:grid-cols-[1fr_auto] sm:px-8">
          <div className="min-w-0">
            <LessonGrid lessons={dots} />
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
              <span className="font-medium text-ink">
                {plan.passed} von {plan.lessons.length} Lektionen sitzen.
              </span>{' '}
              {plan.passed === 0
                ? 'Noch keine — das ändert die erste Runde.'
                : plan.feasibility.fits
                  ? `Stoff fertig am ${plan.readyByLabel}, danach ${plan.bufferDays} Tage Puffer.`
                  : `Für den Stichtag ${plan.readyByLabel} fehlen ${humanMinutes(
                      plan.feasibility.shortfallMinutes,
                    )}.`}
            </p>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
              {[
                ['bg-pos', 'sitzt'],
                ['bg-accent/35', 'angefangen'],
                ['bg-oxide/45', 'auffrischen'],
                ['bg-sink', 'offen'],
              ].map(([c, l]) => (
                <li key={l} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-[2px] border border-rule ${c}`} /> {l}
                </li>
              ))}
            </ul>
          </div>

          <dl className="flex gap-8 border-t border-rule pt-5 sm:flex-col sm:gap-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <div>
              <dt className="eyebrow">Prognose</dt>
              <dd className="numeral mt-1.5 text-[26px] leading-none">
                {readiness.coverage >= 8 ? (
                  <>
                    <AnimatedNumber value={readiness.score} />
                    <span className="text-[15px]">%</span>
                  </>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Serie</dt>
              <dd className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={progress.streak.current} />
                <span className="ml-1 font-mono text-[11px] font-normal text-faint">
                  {progress.streak.current === 1 ? 'Tag' : 'Tage'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {risk && risk.riskPoints >= 3 && (
          <p className="mt-3 text-[12.5px] text-faint">
            Größte Lücke gerade:{' '}
            <Link href={`/themen/${risk.topicId}`} className="text-muted hover:text-accent">
              {TOPIC_BY_ID[risk.topicId]?.title}
            </Link>{' '}
            — rund {risk.riskPoints.toFixed(0)} Klausurpunkte.
          </p>
        )}
      </section>

      {/* ----------------------------- 4. Morgen ----------------------------- */}
      {tomorrow && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 className="text-[17px]">Morgen</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
              {tomorrow.weekday} {tomorrow.label}
            </span>
            <span className="mx-1 hidden h-px flex-1 bg-rule sm:block" />
            <Link href="/plan" className="text-[12.5px] text-accent hover:underline">
              Ganzer Plan
            </Link>
          </div>

          <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
            {tomorrow.blocks.map((b, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className="eyebrow w-[92px] shrink-0">{BLOCK_LABEL[b.kind]}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{b.title}</span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-faint">
                  {humanMinutes(b.minutes)}
                </span>
              </li>
            ))}
            {tomorrow.blocks.length === 0 && (
              <li className="px-5 py-3 text-[13px] text-faint">Frei — der Plan ist durch.</li>
            )}
          </ul>

          {tomorrow.milestone && (
            <p className="mt-3 border-l-2 border-accent pl-3 text-[13px] text-accent">{tomorrow.milestone}</p>
          )}
        </section>
      )}

      {/* Alles Weitere ist bewusst nur ein Link, keine Kachel. */}
      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-5 text-[13px]">
        {[
          ['/themen', 'Themen und Theorie'],
          ['/klausur', 'Probeklausur schreiben'],
          ['/compiler', 'Compiler öffnen'],
          ['/material', 'Material nachschlagen'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="text-muted transition-colors hover:text-accent">
            {label}
          </Link>
        ))}
      </nav>
    </div>
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
  const base = first.length >= 7 ? first : title
  return base.length > 22 ? base.slice(0, 21).trimEnd().replace(/[,&:]$/, '') + '…' : base
}
