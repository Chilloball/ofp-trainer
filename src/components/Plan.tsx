'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import {
  BLOCK_LABEL,
  EXAM_POINTS,
  PHASES,
  STATUS_LABEL,
  humanMinutes,
  type LessonState,
  type Phase,
  type PlanDay,
} from '@/lib/curriculum'
import { Loading, SectionHead } from './ui'
import { Meter, toneFor } from './viz'
import { Page } from './Shell'

/* ==================================================================== *
 *  Der Lernplan
 *
 *  Aufbau der Seite folgt drei Fragen in genau dieser Reihenfolge:
 *    1. Geht das überhaupt auf?      → Machbarkeit
 *    2. Was mache ich heute?         → Tagesblöcke
 *    3. Wo stehe ich im Ganzen?      → Kursliste und Zeitschiene
 * ==================================================================== */

const PHASE_ORDER: Phase[] = ['aufbau', 'verzahnen', 'klausurformat', 'puffer']

export function PlanView() {
  const { ready, plan, index, loadError } = useStore()
  const [showAll, setShowAll] = useState(false)

  if (loadError) {
    return (
      <Page title="Lernplan">
        <div className="panel border-neg/35 bg-negSoft px-5 py-4 text-[14px] text-neg">{loadError}</div>
      </Page>
    )
  }

  if (!ready || !plan || !index) {
    return (
      <Page title="Lernplan">
        <Loading label="Plan wird gerechnet …" lines={4} />
      </Page>
    )
  }

  const { feasibility: f, lessons } = plan
  const phase = PHASES[plan.phase]
  const open = lessons.filter((l) => l.status === 'offen' || l.status === 'laufend')

  return (
    <Page
      eyebrow={`Phase ${PHASE_ORDER.indexOf(plan.phase) + 1} von 4 · ${phase.title}`}
      title="Von hier bis zum 31. August"
      lead={phase.goal}
      width="wide"
      meta={[
        { label: 'Stoff fertig am', value: `${plan.readyByLabel} (${plan.readyInDays} T)` },
        { label: 'Puffer danach', value: `${plan.bufferDays} Tage` },
        { label: 'Lektionen', value: `${plan.passed} / ${lessons.length}` },
        { label: 'Restaufwand', value: humanMinutes(f.requiredMinutes) },
      ]}
    >
      <Timeline plan={plan} />

      <Feasibility plan={plan} />

      {/* ---------------------------- Heute ---------------------------- */}
      <section className="mt-12">
        <SectionHead
          title="Heute"
          hint={
            plan.today.minutes > 0
              ? `${humanMinutes(plan.today.minutes)} · ${plan.today.weekday}, ${plan.today.label}`
              : undefined
          }
          action={
            plan.today.actuallyDone > 0 ? (
              <span className="font-mono text-[11.5px] tabular-nums text-pos">
                {plan.today.actuallyDone} Aufgaben erledigt
              </span>
            ) : undefined
          }
        />
        <DayBlocks day={plan.today} />
      </section>

      {/* ---------------------------- Der Kurs ---------------------------- */}
      <section className="mt-12">
        <SectionHead
          title="Der Kurs"
          hint="zwanzig Lektionen in der Reihenfolge der Vorlesung"
          action={
            <button onClick={() => setShowAll((v) => !v)} className="btn-quiet btn-sm">
              {showAll ? 'Nur offene zeigen' : `Alle ${lessons.length} zeigen`}
            </button>
          }
        />
        <LessonList lessons={showAll ? lessons : open.length ? open : lessons} nextId={plan.nextLesson?.id} />
        {!showAll && open.length > 0 && open.length < lessons.length && (
          <p className="mt-3 text-[13px] text-faint">
            {lessons.length - open.length} Lektionen sind bereits durch und werden nur noch über die Wiederholung
            aufgefrischt.
          </p>
        )}
      </section>

      {/* -------------------------- Nächste Tage -------------------------- */}
      <section className="mt-12">
        <SectionHead title="Die nächsten Tage" hint="wird jeden Tag neu aus deinem Stand gerechnet" />
        <UpcomingDays days={plan.days.slice(1, 15)} />
      </section>
    </Page>
  )
}

/* ----------------------------- Zeitschiene ----------------------------- */

/**
 * Die verbleibende Zeit als ein Band, in vier Phasen geteilt. Die Breite
 * jedes Abschnitts entspricht seiner Dauer. Beantwortet in einem Blick:
 * Wie lange habe ich noch für Neues, bevor nur noch geprüft wird?
 */
function Timeline({ plan }: { plan: ReturnType<typeof useStore>['plan'] }) {
  const segments = useMemo(() => {
    if (!plan) return []
    const counts = new Map<Phase, number>()
    for (const d of plan.days) counts.set(d.phase, (counts.get(d.phase) ?? 0) + 1)
    return PHASE_ORDER.filter((p) => (counts.get(p) ?? 0) > 0).map((p) => ({
      phase: p,
      days: counts.get(p) ?? 0,
      info: PHASES[p],
    }))
  }, [plan])

  if (!plan || segments.length === 0) return null
  const total = segments.reduce((s, x) => s + x.days, 0) || 1

  return (
    <div className="rounded-md border border-rule bg-surface px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="eyebrow">Zeitschiene</span>
        <span className="font-mono text-[11px] tabular-nums text-faint">
          heute → fertig am {plan.readyByLabel} → Klausur 31.08.
        </span>
      </div>

      {/* Tagesraster: eine Zelle je Tag, in Phasen gruppiert. Man sieht
          die verbleibende Zeit als abzählbare Menge, nicht als Balken —
          „noch zwölf Kästchen Aufbau" ist greifbarer als „52 %". */}
      <div className="mt-4 flex w-full gap-[3px]">
        {segments.map((s) => {
          const active = s.phase === plan.phase
          return (
            <div
              key={s.phase}
              className="min-w-0"
              style={{ width: `${(s.days / total) * 100}%` }}
              title={`${s.info.title}: ${s.days} ${s.days === 1 ? 'Tag' : 'Tage'}`}
            >
              <div className="flex h-7 gap-[2px]">
                {Array.from({ length: s.days }).map((_, d) => (
                  <span
                    key={d}
                    className={`min-w-[2px] flex-1 rounded-[1px] ${
                      active
                        ? d === 0
                          ? 'bg-accent'
                          : 'bg-accent/35'
                        : s.phase === 'puffer'
                          ? 'bg-oxide/45'
                          : 'bg-ruleStrong/55'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-2 min-w-0 border-t border-rule pt-1.5">
                <span
                  className={`block truncate text-[12px] font-medium leading-tight ${
                    active ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {s.info.title}
                </span>
                <span className="block font-mono text-[10px] tabular-nums leading-tight text-faint">
                  {s.days} {s.days === 1 ? 'Tag' : 'Tage'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 border-t border-rule pt-4">
        <p className="pretty max-w-prose text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-ink">Jetzt: {PHASES[plan.phase].title}.</span> {PHASES[plan.phase].goal}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------ Machbarkeit ------------------------------ */

/**
 * Der ehrliche Teil. Ein Lernplan, der so tut, als ginge alles auf, ist
 * wertlos — die Frage „reicht die Zeit?" ist die erste, die sich jeder
 * stellt, und sie verdient eine Zahl statt einer Beruhigung.
 */
function Feasibility({ plan }: { plan: NonNullable<ReturnType<typeof useStore>['plan']> }) {
  const { progress } = useStore()
  const f = plan.feasibility
  const scale = Math.max(1, f.requiredMinutes, f.availableMinutes)

  return (
    <div className="mt-6 rounded-md border border-rule bg-surface">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule px-5 py-3">
        <span className="eyebrow">Machbarkeit</span>
        <span className={`text-[13.5px] font-medium ${f.fits ? 'text-pos' : 'text-neg'}`}>
          {f.fits ? 'Der Plan geht auf.' : `Es fehlen ${humanMinutes(f.shortfallMinutes)}.`}
        </span>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          {/* Zwei Balken auf EINER Skala. Ein einzelner Balken, der über
              den Rand läuft, verschweigt genau die Zahl, um die es geht:
              wie viel zu viel es ist. */}
          <div className="space-y-2">
            {[
              {
                label: 'Restaufwand',
                value: f.requiredMinutes,
                fill: f.fits ? 'bg-accent' : 'bg-neg',
                text: f.fits ? 'text-ink' : 'text-neg',
              },
              { label: 'Verfügbar bis zur Klausur', value: f.availableMinutes, fill: 'bg-ruleStrong', text: 'text-muted' },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-[172px] shrink-0 text-[12.5px] text-muted">{row.label}</span>
                <span className="h-5 min-w-0 flex-1 rounded-sm bg-canvas">
                  <span
                    className={`block h-full rounded-sm ${row.fill}`}
                    style={{ width: `${Math.max(2, (row.value / scale) * 100)}%` }}
                  />
                </span>
                <span className={`w-[62px] shrink-0 text-right font-mono text-[11.5px] tabular-nums ${row.text}`}>
                  {humanMinutes(row.value)}
                </span>
              </div>
            ))}
          </div>

          <p className="pretty mt-4 max-w-prose text-[13.5px] leading-relaxed text-muted">
            Gerechnet bis zum <span className="font-medium text-ink">{plan.readyByLabel}</span> — {plan.bufferDays}{' '}
            Tage vor der Klausur, damit noch Luft bleibt. {progress.settings.dailyGoal} Aufgaben pro Tag, davon 30 %
            für Wiederholung.{' '}
            {f.fits ? (
              <>Du hast Luft — nutze sie für zusätzliche Probeklausuren.</>
            ) : (
              <>
                Mit {humanMinutes(f.neededPerDay)} pro Tag ginge es auf. Sonst musst du etwas streichen — und dann
                das, was am wenigsten Punkte pro Minute bringt:
              </>
            )}
          </p>

          {!f.fits && f.cutCandidates.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {f.cutCandidates.map((l) => (
                <li key={l.id}>
                  <Link href={`/themen/${l.topicId}`} className="tag hover:border-ruleStrong">
                    {l.title} · {l.points} P / {humanMinutes(l.remainingMinutes)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-x-7 gap-y-3 lg:grid-cols-1 lg:border-l lg:border-rule lg:pl-7">
          <div>
            <dt className="eyebrow">Offen</dt>
            <dd className="numeral mt-1.5 text-[21px]">
              {plan.lessons.length - plan.passed}
              <span className="ml-1 font-mono text-[11px] font-normal text-faint">Lektionen</span>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Pro Tag nötig</dt>
            <dd className="numeral mt-1.5 text-[21px]">{humanMinutes(f.neededPerDay)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Punkte offen</dt>
            <dd className="numeral mt-1.5 text-[21px]">
              {Math.round(
                plan.lessons.filter((l) => l.status !== 'sitzt').reduce((s, l) => s + l.riskPoints, 0),
              )}
              <span className="ml-1 font-mono text-[11px] font-normal text-faint">von {EXAM_POINTS}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

/* ----------------------------- Tagesblöcke ----------------------------- */

const BLOCK_TONE: Record<string, string> = {
  lektion: 'border-l-accent',
  wiederholung: 'border-l-pos',
  gemischt: 'border-l-oxide',
  klausur: 'border-l-ink',
  fehler: 'border-l-neg',
  ruhe: 'border-l-ruleStrong',
}

export function DayBlocks({ day, compact = false }: { day: PlanDay; compact?: boolean }) {
  if (day.blocks.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-ruleStrong px-5 py-6 text-[13.5px] text-muted">
        Für heute steht nichts mehr an.
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {day.blocks.map((b, i) => (
        <li key={i}>
          <div
            className={`flex flex-wrap items-start gap-x-5 gap-y-3 rounded-md border border-rule border-l-2 bg-surface px-4 py-3.5 ${
              BLOCK_TONE[b.kind] ?? 'border-l-rule'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="eyebrow">{BLOCK_LABEL[b.kind]}</span>
                <span className="text-[15px] font-medium leading-snug">{b.title}</span>
              </div>
              {!compact && <p className="pretty mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted">{b.why}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <span className="font-mono text-[11px] tabular-nums text-faint">
                {humanMinutes(b.minutes)}
                {b.count > 0 && ` · ${b.count} Aufg.`}
              </span>
              <Link href={b.href} className={i === 0 ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
                {b.kind === 'klausur' ? 'Zur Auswahl' : 'Starten'}
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------ Kursliste ------------------------------ */

function LessonList({ lessons, nextId }: { lessons: LessonState[]; nextId?: string }) {
  let lastLang: string | null = null

  return (
    <ol className="overflow-hidden rounded-md border border-rule bg-surface">
      {lessons.map((l) => {
        const newLang = l.lang !== lastLang
        lastLang = l.lang
        const isNext = l.id === nextId
        const status = STATUS_LABEL[l.status]

        return (
          <li key={l.id}>
            {newLang && (
              <div className="flex items-center gap-3 border-b border-rule bg-raised px-4 py-2">
                <span className={`tag ${l.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                  {l.lang === 'python' ? 'Python' : 'Java'}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
                  {l.lang === 'python' ? 'Vorlesung 1–7 · 49 Punkte' : 'Vorlesung 8–13 · 54 Punkte'}
                </span>
              </div>
            )}

            <div
              className={`flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-rule px-4 py-3 transition-colors last:border-b-0 ${
                isNext ? 'bg-accent/6' : 'hover:bg-raised'
              }`}
            >
              {/* Nummer */}
              <span
                className={`w-7 shrink-0 font-mono text-[12px] tabular-nums ${
                  l.status === 'sitzt' ? 'text-pos' : isNext ? 'text-accent' : 'text-faint'
                }`}
              >
                {l.status === 'sitzt' ? (
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3.5 8.4 3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  String(l.order).padStart(2, '0')
                )}
              </span>

              {/* Titel */}
              <div className="min-w-[190px] flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <Link href={`/themen/${l.topicId}`} className="text-[14.5px] font-medium hover:text-accent">
                    {l.title}
                  </Link>
                  {isNext && <span className="tag tag-accent">als Nächstes</span>}
                </div>
                <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.07em] text-faint">
                  {l.lecture}
                  {l.missingPrereqs.length > 0 && l.status === 'offen' && (
                    <> · baut auf {l.missingPrereqs.length} noch offenen Thema{l.missingPrereqs.length > 1 ? 'en' : ''} auf</>
                  )}
                </div>
              </div>

              {/* Stand */}
              <div className="w-[132px] shrink-0">
                <Meter value={l.mastery} tone={toneFor(l.mastery, l.seen > 0)} />
                <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10.5px] tabular-nums text-faint">
                  <span>{l.seen > 0 ? `${Math.round(l.mastery * 100)} %` : '—'}</span>
                  <span>
                    {l.seen}/{l.planned}
                  </span>
                </div>
              </div>

              {/* Punkte + Aufwand */}
              <div className="w-[92px] shrink-0 text-right font-mono text-[11px] tabular-nums">
                <div className="text-ink">{l.points} P</div>
                <div className="text-faint">
                  {l.status === 'sitzt' ? 'fertig' : humanMinutes(l.remainingMinutes)}
                </div>
              </div>

              {/* Status + Aktion */}
              <div className="flex w-[168px] shrink-0 items-center justify-end gap-2.5">
                <span className={status.tag}>{status.label}</span>
                <Link
                  href={`/ueben?thema=${l.topicId}`}
                  className={isNext ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  {l.seen === 0 ? 'Beginnen' : l.status === 'sitzt' ? 'Auffrischen' : 'Weiter'}
                </Link>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ----------------------------- Nächste Tage ----------------------------- */

function UpcomingDays({ days }: { days: PlanDay[] }) {
  if (days.length === 0) return null

  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {days.map((d) => (
        <li key={d.date} className="rounded-md border border-rule bg-surface px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11.5px] font-medium tabular-nums text-ink">
              {d.weekday} {d.label}
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-faint">T−{d.daysLeft}</span>
            <span className="ml-auto font-mono text-[10.5px] tabular-nums text-faint">
              {humanMinutes(d.minutes)}
            </span>
          </div>

          {d.milestone && (
            <div className="mt-2 border-l-2 border-accent pl-2.5 text-[12.5px] font-medium text-accent">
              {d.milestone}
            </div>
          )}

          <ul className="mt-2 space-y-1">
            {d.blocks.map((b, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12.5px] text-muted">
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
                <span className="min-w-0 truncate">{b.title}</span>
              </li>
            ))}
            {d.blocks.length === 0 && <li className="text-[12.5px] text-faint">frei</li>}
          </ul>
        </li>
      ))}
    </ol>
  )
}
