'use client'

import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '@/lib/types'
import { EXAM_DATE } from '@/content/topics'
import { useStore } from '@/lib/store'
import { loadExercises } from '@/lib/content'
import { DEFAULT_BUFFER } from '@/lib/curriculum'
import { calendarDaysUntil } from '@/lib/day'
import { ExerciseView } from './Exercise'
import { ForgettingCurve, InterleaveVsBlock, LearnLoop } from './explain'
import { LogoMark } from './Logo'
import { AnimatedNumber } from './ui'

/* ==================================================================== *
 *  ONBOARDING
 *
 *  Sieben Schritte, jeder mit genau EINER Aussage. Kein Schritt hat
 *  mehr als zwei Sätze Fließtext — wo etwas zu erklären ist, erklärt es
 *  eine Grafik.
 *
 *  Am Ende ist eingerichtet, was eingerichtet werden muss: Tempo,
 *  dauerhafter Speicher, Name. Und der Lernende hat einmal die volle
 *  Schleife erlebt: Aufgabe → Antwort → Rückmeldung.
 * ==================================================================== */

const EASE = [0.22, 1, 0.36, 1] as const

/** Minuten pro Tag → Aufgaben pro Tag (rund 2,4 min je Aufgabe). */
const PACE = [
  { minutes: 15, goal: 6, label: '15 min', hint: 'nebenher' },
  { minutes: 30, goal: 12, label: '30 min', hint: 'solide' },
  { minutes: 45, goal: 19, label: '45 min', hint: 'zügig' },
  { minutes: 75, goal: 31, label: '75 min', hint: 'Vollgas' },
]

type StepId = 'start' | 'tempo' | 'speicher' | 'schleife' | 'wiederholen' | 'probe' | 'fertig'

const STEPS: StepId[] = ['start', 'tempo', 'speicher', 'schleife', 'wiederholen', 'probe', 'fertig']

export function Onboarding() {
  const { index, setName, setSetting, makeStoragePersistent, health, toast } = useStore()
  const router = useRouter()
  const still = useReducedMotion()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [name, setLocalName] = useState('')
  const [pace, setPace] = useState(1)
  const paceChosen = useRef(false)
  const [persistResult, setPersistResult] = useState<'offen' | 'laeuft' | 'ja' | 'nein'>('offen')
  const [probe, setProbe] = useState<Exercise | null>(null)
  const [probeDone, setProbeDone] = useState(false)

  const id = STEPS[step]
  const left = Math.max(0, calendarDaysUntil(EXAM_DATE))
  const chosen = PACE[pace]

  /* Wie lange der Stoff bei einem gegebenen Tempo dauert. 55 % der
     Aufgaben reichen für die Gates, rund 2,4 min je Aufgabe, davon
     30 % der Tageszeit für Wiederholung reserviert. */
  const forecastFor = useCallback(
    (minutes: number) => {
      const neededMin = (index?.total ?? 528) * 0.55 * 2.4
      const daysNeeded = Math.ceil(neededMin / Math.max(1, minutes * 0.7))
      return {
        daysNeeded,
        buffer: Math.max(0, left - daysNeeded),
        fits: daysNeeded + DEFAULT_BUFFER <= left,
        possible: daysNeeded <= left,
      }
    },
    [index, left],
  )

  const forecast = useMemo(() => forecastFor(chosen.minutes), [forecastFor, chosen])

  /* Kluge Vorauswahl: die langsamste Stufe, die noch mit Puffer aufgeht.
     Eine Voreinstellung, die von vornherein nicht reicht, ist keine. */
  useEffect(() => {
    if (!index || paceChosen.current) return
    const fitting = PACE.findIndex((p) => forecastFor(p.minutes).fits)
    setPace(fitting >= 0 ? fitting : PACE.length - 1)
  }, [index, forecastFor])

  const go = useCallback((delta: number) => {
    setDir(delta)
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)))
  }, [])

  /* Probeaufgabe im Hintergrund holen, sobald der Index da ist. */
  useEffect(() => {
    if (!index || probe) return
    const meta =
      index.items.find((i) => i.type === 'mc' && i.difficulty <= 2 && i.lang === 'python') ??
      index.items.find((i) => i.type === 'mc')
    if (!meta) return
    void loadExercises([meta])
      .then((list) => list[0] && setProbe(list[0]))
      .catch(() => setProbe(null))
  }, [index, probe])

  const finish = useCallback(() => {
    if (name.trim()) setName(name)
    setSetting('dailyGoal', chosen.goal)
    setSetting('onboarded', true)
    router.push('/plan')
  }, [name, chosen, setName, setSetting, router])

  /* Eingabetaste blättert weiter — außer im Textfeld und in der Aufgabe. */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('article'))) return
      e.preventDefault()
      if (id === 'fertig') finish()
      else go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [id, go, finish])

  const askPersist = async () => {
    setPersistResult('laeuft')
    const ok = await makeStoragePersistent()
    setPersistResult(ok ? 'ja' : 'nein')
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[640px] flex-col px-5 py-8 sm:py-12">
      {/* Fortschrittspunkte */}
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => {
              setDir(i > step ? 1 : -1)
              setStep(i)
            }}
            aria-label={`Schritt ${i + 1} von ${STEPS.length}`}
            aria-current={i === step ? 'step' : undefined}
            className="group py-2"
            style={{ flex: i === step ? 3 : 1 }}
          >
            <span
              className={`block h-[3px] rounded-full transition-colors duration-300 ${
                i < step ? 'bg-accent' : i === step ? 'bg-accent' : 'bg-rule group-hover:bg-ruleStrong'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        {/* Bewusst OHNE AnimatePresence: Bei `mode="wait"` blieb ein
            Schrittwechsel hängen, wenn der nächste Klick kam, bevor die
            Ausblendung fertig war — der Zustand sprang weiter, der
            Inhalt nicht. Ein neu eingeblendeter Schritt reicht völlig;
            das Ausblenden des alten sieht sowieso niemand. */}
        <div>
          <motion.div
            key={id}
            initial={still ? false : { opacity: 0, x: dir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {/* ------------------------------ Start ------------------------------ */}
            {id === 'start' && (
              <Step
                eyebrow="Universität Siegen · Klausur am 31. August 2026"
                title="Objektorientierte und Funktionale Programmierung"
                lead="Fünf Fragen, dann steht dein Lernplan — und du weißt jeden Tag, was dran ist."
                icon={
                  <span className="text-ink">
                    <LogoMark size={44} animate />
                  </span>
                }
              >
                <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-rule pt-6">
                  {[
                    [String(index?.total ?? 528), 'Aufgaben'],
                    ['20', 'Lektionen'],
                    [String(left), 'Tage übrig'],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <dt className="numeral text-[26px] leading-none">{v}</dt>
                      <dd className="eyebrow mt-1.5">{l}</dd>
                    </div>
                  ))}
                </dl>
              </Step>
            )}

            {/* ------------------------------ Tempo ------------------------------ */}
            {id === 'tempo' && (
              <Step
                eyebrow={`Schritt ${step} von ${STEPS.length - 2}`}
                title="Wie viel Zeit hast du am Tag?"
                lead="Danach richtet sich alles Weitere. Ändern kannst du es jederzeit."
              >
                <div className="mt-7 grid grid-cols-4 gap-2">
                  {PACE.map((p, i) => (
                    <button
                      key={p.minutes}
                      onClick={() => {
                        paceChosen.current = true
                        setPace(i)
                      }}
                      aria-pressed={pace === i}
                      className={`rounded-md border px-2 py-3 text-center transition-all duration-200 ${
                        pace === i
                          ? 'border-accent bg-accent/8 text-ink'
                          : 'border-rule text-muted hover:border-ruleStrong hover:text-ink'
                      }`}
                    >
                      <span className="block font-mono text-[14px] font-medium tabular-nums">{p.label}</span>
                      <span className="mt-0.5 block text-[11px] text-faint">{p.hint}</span>
                    </button>
                  ))}
                </div>

                {/* Die Folge der Wahl — sofort sichtbar, nicht erst später */}
                <motion.div
                  key={pace}
                  initial={still ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="mt-6 rounded-md border-l-2 border-l-accent border-y border-r border-rule bg-surface px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <span>
                      <span className="numeral text-[27px] leading-none">
                        <AnimatedNumber value={forecast.daysNeeded} />
                      </span>
                      <span className="ml-1.5 font-mono text-[11px] text-faint">Tage für den Stoff</span>
                    </span>
                    <span>
                      <span
                        className={`numeral text-[27px] leading-none ${
                          forecast.fits ? 'text-pos' : 'text-neg'
                        }`}
                      >
                        {forecast.possible ? <AnimatedNumber value={forecast.buffer} /> : '—'}
                      </span>
                      <span className="ml-1.5 font-mono text-[11px] text-faint">
                        {forecast.possible ? 'Tage Puffer' : `${forecast.daysNeeded - left} Tage fehlen`}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
                    {forecast.fits
                      ? 'Das geht auf — mit Reserve, falls eine Woche ausfällt.'
                      : forecast.possible
                        ? 'Machbar, aber ohne Puffer. Fällt eine Woche aus, wird es eng.'
                        : `Bei ${left} Tagen reicht das nicht für alles. Der Plan geht dann nach Klausurpunkten vor und sagt dir, was du streichen kannst.`}
                  </p>
                </motion.div>

                <div className="mt-7">
                  <label className="label" htmlFor="ob-name">
                    Wie sollen wir dich nennen? (freiwillig)
                  </label>
                  <input
                    id="ob-name"
                    className="field"
                    value={name}
                    onChange={(e) => setLocalName(e.target.value)}
                    placeholder="Vorname"
                    autoComplete="given-name"
                    maxLength={40}
                  />
                </div>
              </Step>
            )}

            {/* ----------------------------- Speicher ----------------------------- */}
            {id === 'speicher' && (
              <Step
                eyebrow={`Schritt ${step} von ${STEPS.length - 2}`}
                title="Dein Lernstand bleibt auf diesem Gerät"
                lead="Kein Konto, keine Übertragung. Damit ihn der Browser nicht irgendwann selbst aufräumt, braucht es einen Klick."
              >
                <div className="mt-7 rounded-md border border-rule bg-surface p-5">
                  <AnimatePresence mode="wait">
                    {persistResult === 'ja' || health?.persistent ? (
                      <motion.div
                        key="ja"
                        initial={still ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-start gap-3"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="mt-0.5 h-6 w-6 shrink-0 text-pos"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                        >
                          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" className="draw" />
                        </svg>
                        <div>
                          <p className="text-[14.5px] font-medium text-pos">Gesichert.</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted">
                            Der Browser behält deinen Lernstand jetzt dauerhaft — auch wenn du wochenlang nicht
                            vorbeischaust.
                          </p>
                        </div>
                      </motion.div>
                    ) : persistResult === 'nein' ? (
                      <motion.div key="nein" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-[14.5px] font-medium text-oxide">Dein Browser hat es nicht zugesagt.</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">
                          Halb so wild — gespeichert wird trotzdem. Lade dir unter <em>Fortschritt</em> ab und zu eine
                          Sicherungsdatei herunter, dann kann nichts verloren gehen.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div key="frage" initial={false} exit={{ opacity: 0 }}>
                        <p className="text-[13.5px] leading-relaxed text-muted">
                          Manche Browser löschen die Daten einer Seite, die länger nicht besucht wurde. Ein Klick nimmt
                          diese App davon aus.
                        </p>
                        <button
                          onClick={askPersist}
                          disabled={persistResult === 'laeuft'}
                          className="btn-primary mt-4"
                        >
                          {persistResult === 'laeuft' ? 'Einen Moment …' : 'Lernstand dauerhaft sichern'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Step>
            )}

            {/* ----------------------------- Schleife ----------------------------- */}
            {id === 'schleife' && (
              <Step
                eyebrow={`Schritt ${step} von ${STEPS.length - 2}`}
                title="So läuft jede Runde"
                lead="Lesen allein fühlt sich wie Können an. Erst der Abruf zeigt den Unterschied."
              >
                <LearnLoop className="mt-7" />
                <div className="mt-7">
                  <InterleaveVsBlock />
                </div>
              </Step>
            )}

            {/* --------------------------- Wiederholen --------------------------- */}
            {id === 'wiederholen' && (
              <Step
                eyebrow={`Schritt ${step} von ${STEPS.length - 2}`}
                title="Deshalb steht jeden Tag Wiederholung an"
                lead="Ohne sie ist nach zwei Wochen die Hälfte weg. Mit ihr hält jede Auffrischung länger als die davor."
              >
                <div className="mt-7 rounded-md border border-rule bg-surface px-5 py-5">
                  <ForgettingCurve days={30} />
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Die App merkt sich für jede Aufgabe, wann sie zu verblassen beginnt, und legt sie dir genau dann
                  wieder vor.
                </p>
              </Step>
            )}

            {/* ------------------------------ Probe ------------------------------ */}
            {id === 'probe' && (
              <Step
                eyebrow={`Schritt ${step} von ${STEPS.length - 2}`}
                title="Einmal ausprobieren"
                lead="Eine echte Aufgabe aus der Sammlung. Schätze vorher ein, wie sicher du dir bist."
              >
                <div className="mt-6">
                  {probe ? (
                    <ExerciseView
                      exercise={probe}
                      onDone={() => setProbeDone(true)}
                      onNext={() => go(1)}
                      support="frei"
                    />
                  ) : (
                    <p className="rounded-md border border-dashed border-ruleStrong px-5 py-8 text-center text-[13.5px] text-muted">
                      Aufgabe wird geladen …
                    </p>
                  )}
                </div>
                {probeDone && (
                  <motion.p
                    initial={still ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-[13px] text-muted"
                  >
                    Genau so läuft es — nur dass der Trainer sich merkt, wie es lief.
                  </motion.p>
                )}
              </Step>
            )}

            {/* ------------------------------ Fertig ------------------------------ */}
            {id === 'fertig' && (
              <Step
                eyebrow="Eingerichtet"
                title={name.trim() ? `Alles bereit, ${name.trim()}.` : 'Alles bereit.'}
                lead={`Dein Plan steht: ${forecast.daysNeeded} Tage Stoff, danach ${forecast.buffer} Tage Puffer bis zur Klausur.`}
              >
                <ul className="mt-7 space-y-3 border-t border-rule pt-6">
                  {[
                    ['Jeden Tag ein klarer Vorschlag', 'Die Startseite sagt dir, was heute dran ist — mehr musst du nicht entscheiden.'],
                    ['Fehler kommen zurück', 'Was nicht saß, kommt am Ende der Runde noch einmal und später erneut.'],
                    ['Der Plan rechnet mit', 'Fällt ein Tag aus, verteilt er den Rest neu — ohne dass du etwas tun musst.'],
                  ].map(([t, d], i) => (
                    <motion.li
                      key={t}
                      initial={still ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.1 }}
                      className="flex gap-3"
                    >
                      <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-[1px] bg-accent" />
                      <span>
                        <span className="block text-[14.5px] font-medium">{t}</span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{d}</span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </Step>
            )}
          </motion.div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-10 flex items-center gap-3 border-t border-rule pt-5">
        {step > 0 && (
          <button onClick={() => go(-1)} className="btn-quiet">
            Zurück
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {id !== 'fertig' && id !== 'start' && (
            <button
              onClick={() => {
                setSetting('dailyGoal', chosen.goal)
                setSetting('onboarded', true)
                toast('Du kannst alles später unter Fortschritt ändern.')
                router.push('/plan')
              }}
              className="btn-quiet !text-faint"
            >
              Überspringen
            </button>
          )}
          {id === 'fertig' ? (
            <button onClick={finish} className="btn-primary btn-lg">
              Zum Lernplan
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 7h9M7.5 3.5 11 7l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button onClick={() => go(1)} className="btn-primary btn-lg">
              {id === 'start' ? 'Los geht’s' : 'Weiter'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Bausteine ------------------------------- */

function Step({
  eyebrow,
  title,
  lead,
  icon,
  children,
}: {
  eyebrow: string
  title: string
  lead: string
  icon?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section>
      {icon && <div className="mb-6">{icon}</div>}
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="mt-3 text-[29px] leading-[1.1] sm:text-[34px]">{title}</h1>
      <p className="pretty mt-3 max-w-prose text-[15px] leading-relaxed text-muted">{lead}</p>
      {children}
    </section>
  )
}
