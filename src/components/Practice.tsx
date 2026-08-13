'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Confidence, Exercise, ExerciseMeta } from '@/lib/types'
import { TOPIC_BY_ID } from '@/content/topics'
import { pickExercises, type PickOptions } from '@/lib/mastery'
import { loadExercises, prefetchTopics } from '@/lib/content'
import { useStore } from '@/lib/store'
import { ExerciseView, type ExerciseResult, type Support } from './Exercise'
import { AnimatedNumber, Kbd, Loading, SectionHead } from './ui'
import { Meter, Ring, toneFor } from './viz'
import { Page } from './Shell'

/* ==================================================================== *
 *  Die Übungsrunde
 *
 *  Aufbau einer Runde:
 *    1. Hauptdurchgang — adaptiv zusammengestellt, Themen verschränkt
 *    2. FEHLERSCHLEIFE — alles, was eben nicht saß, sofort noch einmal
 *    3. Bericht — was gelernt wurde, wie gut die Selbsteinschätzung war
 *
 *  Die Fehlerschleife ist kein Komfort, sondern der Punkt mit dem
 *  größten Effekt: Ein Test unmittelbar nach der Rückmeldung verhindert,
 *  dass der alte Fehler bei einem späteren Abruf zurückkehrt. Ohne ihn
 *  taucht genau derselbe falsche Gedanke später wieder auf.
 * ==================================================================== */

type Mode = PickOptions['mode']

type Phase = 'haupt' | 'schleife-intro' | 'schleife' | 'bericht'

interface Scored {
  meta: ExerciseMeta
  score: number
  ms: number
  confidence?: Confidence
  /** Ergebnis im zweiten Durchgang, falls die Aufgabe in der Schleife war */
  retryScore?: number
}

const MODE_LABEL: Record<string, { title: string; lead: string }> = {
  adaptive: {
    title: 'Übungsrunde',
    lead: 'Zusammengestellt nach Fälligkeit, Klausurgewicht und deinem Stand — Themen bewusst gemischt.',
  },
  due: {
    title: 'Wiederholung',
    lead: 'Aufgaben, deren Wissen laut Vergessenskurve gerade zu verblassen beginnt.',
  },
  weakest: { title: 'Schwächste Themen', lead: 'Konzentriert auf die Themen mit dem größten Rückstand.' },
  new: { title: 'Neue Aufgaben', lead: 'Aufgaben, die du noch nie bearbeitet hast.' },
  mistakes: {
    title: 'Fehler nacharbeiten',
    lead: 'Aufgaben, bei denen du zuletzt danebenlagst oder die du markiert hast.',
  },
  exam: { title: 'Klausurformat', lead: 'Nur Aufgaben in der Form, in der sie in der Klausur vorkommen.' },
  topic: { title: 'Thema üben', lead: '' },
}

/** Ab hier gilt eine Aufgabe als „saß nicht" und kommt in die Schleife. */
const LOOP_THRESHOLD = 0.7

export function Practice() {
  const params = useSearchParams()
  const router = useRouter()
  const { ready, index, progress, mastery, recordAnswer, toggleFlag } = useStore()

  const topicId = params.get('thema') ?? undefined
  const topicList = useMemo(
    () => params.get('themen')?.split(',').filter(Boolean) ?? undefined,
    [params],
  )
  const langParam = params.get('sprache') as 'python' | 'java' | null
  const lengthParam = Number(params.get('laenge'))

  const mode: Mode = topicId ? 'topic' : topicList?.length ? 'adaptive' : ((params.get('modus') ?? 'adaptive') as Mode)

  const [queue, setQueue] = useState<Exercise[] | null>(null)
  const [pos, setPos] = useState(0)
  const [scores, setScores] = useState<Scored[]>([])
  const [phase, setPhase] = useState<Phase>('haupt')
  const [loopQueue, setLoopQueue] = useState<Exercise[]>([])
  const [loopPos, setLoopPos] = useState(0)
  const [loading, setLoading] = useState(false)
  /* Führungsgrad je Aufgabe — EINMAL beim Zusammenstellen festgelegt.
     Würde er live aus dem Lernstand folgen, änderte er sich mitten in
     der Bearbeitung. */
  const [support, setSupport] = useState<Record<string, Support>>({})
  const buildKey = useRef('')

  const count =
    Number.isFinite(lengthParam) && lengthParam >= 3 && lengthParam <= 40
      ? Math.round(lengthParam)
      : progress.settings.sessionLength
  const focus = progress.settings.focus
  const lang: 'python' | 'java' | 'both' = langParam ?? (focus === 'python' || focus === 'java' ? focus : 'both')

  const build = useCallback(async () => {
    if (!index) return
    setLoading(true)
    const picked = pickExercises(progress, index.items, {
      count,
      mode,
      lang,
      topicIds: topicId ? [topicId] : topicList,
    })
    const full = await loadExercises(picked)

    /* Abnehmende Hilfe: die erste Aufgabe eines völlig neuen Themas
       kommt als gelöstes Beispiel, die nächsten mit aufgeklapptem Tipp,
       ab einem Beherrschungsgrad von 30 % ohne alles. */
    const firstOfTopic = new Set<string>()
    const sup: Record<string, Support> = {}
    for (const p of picked) {
      const m = mastery[p.topicId]
      if ((m?.seen ?? 0) === 0 && !firstOfTopic.has(p.topicId)) {
        sup[p.id] = 'beispiel'
        firstOfTopic.add(p.topicId)
      } else if ((m?.mastery ?? 0) < 0.3) {
        sup[p.id] = 'gefuehrt'
      } else {
        sup[p.id] = 'frei'
      }
    }
    setSupport(sup)

    setQueue(full)
    setPos(0)
    setScores([])
    setPhase('haupt')
    setLoopQueue([])
    setLoopPos(0)
    setLoading(false)
    prefetchTopics([...new Set(picked.map((p) => p.topicId))])
    /* progress gehört dazu: „Nächste Runde" muss den Stand von eben
       berücksichtigen, sonst kämen gerade beantwortete Aufgaben wieder. */
  }, [index, progress, mastery, mode, topicId, topicList, lang, count])

  useEffect(() => {
    if (!ready || !index) return
    const key = `${mode}|${topicId ?? ''}|${topicList?.join('+') ?? ''}|${lang}|${count}`
    if (buildKey.current === key) return
    buildKey.current = key
    void build()
  }, [ready, index, mode, topicId, topicList, lang, count, build])

  /* ------------------------------ Ablauf ------------------------------ */

  const current = phase === 'schleife' ? loopQueue[loopPos] : queue?.[pos]

  const record = useCallback(
    (ex: Exercise, r: ExerciseResult) => {
      const meta = index?.items.find((i) => i.id === ex.id)
      if (meta) recordAnswer(meta, r)
      return meta
    },
    [index, recordAnswer],
  )

  /* Bucht die Antwort — blättert bewusst NICHT weiter. Die Rückmeldung
     bleibt stehen, bis der Lernende sie gelesen hat. */
  const onDone = useCallback(
    (r: ExerciseResult) => {
      if (!current) return
      const meta = record(current, r)
      if (!meta) return

      if (phase === 'schleife') {
        setScores((s) => s.map((x) => (x.meta.id === meta.id ? { ...x, retryScore: r.score } : x)))
      } else {
        setScores((s) =>
          s.some((x) => x.meta.id === meta.id)
            ? s
            : [...s, { meta, score: r.score, ms: r.ms, confidence: r.confidence }],
        )
      }
    },
    [current, phase, record],
  )

  const onNext = useCallback(() => {
    if (phase === 'schleife') setLoopPos((p) => p + 1)
    else setPos((p) => p + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase])

  const onSkip = useCallback(() => {
    if (phase === 'schleife') setLoopPos((p) => p + 1)
    else setPos((p) => p + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase])

  /* Hauptdurchgang zu Ende → Fehlerschleife anbieten oder Bericht. */
  useEffect(() => {
    if (phase !== 'haupt' || !queue || queue.length === 0 || pos < queue.length) return
    const missed = scores.filter((s) => s.score < LOOP_THRESHOLD).map((s) => s.meta.id)
    const again = queue.filter((q) => missed.includes(q.id))
    if (again.length > 0) {
      setLoopQueue(again)
      setLoopPos(0)
      setPhase('schleife-intro')
    } else {
      setPhase('bericht')
    }
  }, [phase, queue, pos, scores])

  /* Fehlerschleife zu Ende → Bericht. */
  useEffect(() => {
    if (phase === 'schleife' && loopQueue.length > 0 && loopPos >= loopQueue.length) setPhase('bericht')
  }, [phase, loopQueue, loopPos])

  const label = topicId
    ? { title: TOPIC_BY_ID[topicId]?.title ?? 'Thema üben', lead: TOPIC_BY_ID[topicId]?.summary ?? '' }
    : (MODE_LABEL[mode] ?? MODE_LABEL.adaptive)

  /* ------------------------------ Zustände ------------------------------ */

  if (!ready || loading || !queue) {
    return (
      <Page eyebrow="Übung" title={label.title} lead={label.lead}>
        <Loading label="Aufgaben werden zusammengestellt …" lines={4} />
      </Page>
    )
  }

  if (phase === 'bericht') {
    return (
      <Page
        eyebrow="Übung"
        title="Runde geschafft"
        lead={`${scores.length} von ${queue.length} Aufgaben bearbeitet.`}
      >
        <Report scores={scores} onAgain={() => void build()} />
      </Page>
    )
  }

  if (phase === 'schleife-intro') {
    return (
      <Page
        eyebrow="Übung"
        title="Fehlerschleife"
        lead={
          loopQueue.length === 1
            ? 'Eine Aufgabe saß noch nicht.'
            : `${loopQueue.length} Aufgaben saßen noch nicht.`
        }
      >
        <div className="max-w-prose">
          <p className="pretty text-[15px] leading-relaxed text-ink">
            {loopQueue.length === 1 ? 'Sie kommt' : 'Diese Aufgaben kommen'} jetzt sofort noch einmal — mit der
            Erklärung frisch im Kopf. Das ist kein
            Nachsitzen: Ein zweiter Abruf direkt nach der Rückmeldung ist der Unterschied zwischen «verstanden» und
            «beim nächsten Mal wieder derselbe Fehler». Ohne ihn taucht der alte Gedanke später zuverlässig wieder auf.
          </p>

          <ul className="mt-6 divide-y divide-rule rounded-md border border-rule bg-surface">
            {loopQueue.map((q) => {
              const s = scores.find((x) => x.meta.id === q.id)
              return (
                <li key={q.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-[1px] bg-neg" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{q.title}</span>
                  {s?.confidence === 2 && <span className="tag tag-bad">warst dir sicher</span>}
                  <span className={`tag ${q.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                    {q.lang === 'python' ? 'Py' : 'Java'}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setPhase('schleife')} className="btn-primary btn-lg">
              Schleife starten
            </button>
            <button onClick={() => setPhase('bericht')} className="btn-quiet">
              Überspringen
            </button>
          </div>
        </div>
      </Page>
    )
  }

  if (!current) {
    return (
      <Page eyebrow="Übung" title={label.title} lead={label.lead}>
        <div className="rounded-md border border-dashed border-ruleStrong px-5 py-12 text-center">
          <p className="text-[15.5px] font-medium">Für diese Auswahl gibt es gerade nichts zu tun.</p>
          <p className="mx-auto mt-2 max-w-prose text-[13.5px] leading-relaxed text-muted">
            Das ist ein gutes Zeichen — alles Fällige ist erledigt. Wähle einen anderen Schwerpunkt oder starte eine
            allgemeine Übungsrunde.
          </p>
          <Link href="/ueben" className="btn-primary mt-5">
            Übungsrunde starten
          </Link>
        </div>
      </Page>
    )
  }

  const inLoop = phase === 'schleife'
  const list = inLoop ? loopQueue : queue
  const at = inLoop ? loopPos : pos
  const right = scores.filter((s) => s.score >= 0.999).length

  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 sm:px-8 sm:py-8">
      {/* Rundenkopf */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[20px]">{inLoop ? 'Fehlerschleife' : label.title}</h1>
          {inLoop && <span className="tag tag-bad">zweiter Durchgang</span>}
          <div className="ml-auto flex items-center gap-4">
            {scores.length > 0 && !inLoop && (
              <span className="font-mono text-[11.5px] tabular-nums text-muted">
                <span className="text-pos">{right}</span> richtig
              </span>
            )}
            <span className="font-mono text-[11.5px] tabular-nums text-faint">
              {at} / {list.length}
            </span>
            <button onClick={() => router.push('/')} className="btn-quiet btn-sm">
              Beenden
            </button>
          </div>
        </div>

        {/* Jede Aufgabe ein Segment: erledigt, aktuell, offen */}
        <div className="mt-3 flex gap-[3px]">
          {list.map((q, i) => {
            const s = scores.find((x) => x.meta.id === q.id)
            const done = inLoop ? i < loopPos : !!s
            const value = inLoop ? s?.retryScore : s?.score
            return (
              <span
                key={q.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  done
                    ? value === undefined
                      ? 'bg-ruleStrong'
                      : value >= 0.999
                        ? 'bg-pos'
                        : value > 0
                          ? 'bg-oxide'
                          : 'bg-neg'
                    : i === at
                      ? 'bg-accent'
                      : 'bg-rule'
                }`}
              />
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id + (inLoop ? '-loop' : '')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'linear' }}
        >
          <ExerciseView
            exercise={current}
            position={at}
            total={list.length}
            onDone={onDone}
            onNext={onNext}
            onSkip={onSkip}
            /* Im zweiten Durchgang gibt es keine Hilfe mehr — dort geht es
               genau darum, ob es jetzt ohne sitzt. */
            support={inLoop ? 'frei' : (support[current.id] ?? 'frei')}
            flagged={progress.items[current.id]?.flagged}
            onToggleFlag={() => toggleFlag(current.id, current.topicId)}
          />
        </motion.div>
      </AnimatePresence>

      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <Kbd>1</Kbd>
          <Kbd>2</Kbd>
          <Kbd>3</Kbd> Sicherheit
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>⌘</Kbd>
          <Kbd>⏎</Kbd> prüfen
        </span>
      </p>
    </div>
  )
}

/* ------------------------------- Bericht ------------------------------- */

function Report({ scores, onAgain }: { scores: Scored[]; onAgain: () => void }) {
  const total = scores.length
  const correct = scores.filter((s) => s.score >= 0.999).length
  const points = scores.reduce((a, s) => a + s.score * s.meta.points, 0)
  const maxPoints = scores.reduce((a, s) => a + s.meta.points, 0)
  const minutes = Math.max(1, Math.round(scores.reduce((a, s) => a + s.ms, 0) / 60000))
  const quote = maxPoints ? points / maxPoints : 0

  /* Kalibrierung: Wie gut passt die Selbsteinschätzung zur Leistung? */
  const rated = scores.filter((s) => s.confidence !== undefined)
  const calib = [0, 1, 2].map((c) => {
    const inBucket = rated.filter((s) => s.confidence === c)
    return {
      confidence: c as Confidence,
      n: inBucket.length,
      hit: inBucket.length ? inBucket.filter((s) => s.score >= 0.999).length / inBucket.length : 0,
    }
  })
  const overconfident = rated.filter((s) => s.confidence === 2 && s.score < LOOP_THRESHOLD)
  const repaired = scores.filter((s) => s.score < LOOP_THRESHOLD && (s.retryScore ?? 0) >= 0.999)

  const weakTopics = [
    ...new Map(
      scores
        .filter((s) => s.score < LOOP_THRESHOLD)
        .map((s) => TOPIC_BY_ID[s.meta.topicId])
        .filter(Boolean)
        .map((t) => [t.id, t]),
    ).values(),
  ]

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
    <div className="space-y-11">
      <section className="flex flex-col items-center gap-9 sm:flex-row">
        <Ring value={quote} size={150} tone={toneFor(quote)}>
          <div>
            <div className="numeral text-[33px] leading-none">
              <AnimatedNumber value={Math.round(quote * 100)} />
              <span className="text-[18px]">%</span>
            </div>
            <div className="eyebrow mt-2">Quote</div>
          </div>
        </Ring>

        <dl className="grid flex-1 grid-cols-3 gap-6">
          <div>
            <dt className="eyebrow">Richtig</dt>
            <dd className="numeral mt-2 text-[25px] leading-none">
              <AnimatedNumber value={correct} />
              <span className="font-mono text-[13px] font-normal text-faint"> / {total}</span>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Punkte</dt>
            <dd className="numeral mt-2 text-[25px] leading-none">
              <AnimatedNumber value={Math.round(points * 10) / 10} decimals={1} />
              <span className="font-mono text-[13px] font-normal text-faint"> / {maxPoints}</span>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Zeit</dt>
            <dd className="numeral mt-2 text-[25px] leading-none">
              <AnimatedNumber value={minutes} />
              <span className="font-mono text-[13px] font-normal text-faint"> min</span>
            </dd>
          </div>
        </dl>
      </section>

      {repaired.length > 0 && (
        <section className="rounded-md border-l-2 border-l-pos border-y border-r border-rule bg-surface px-5 py-4">
          <div className="eyebrow !text-pos">In der Schleife repariert</div>
          <p className="pretty mt-2 max-w-prose text-[13.5px] leading-relaxed text-muted">
            {repaired.length} {repaired.length === 1 ? 'Aufgabe saß' : 'Aufgaben saßen'} im ersten Anlauf nicht und im
            zweiten. Genau dieser sofortige zweite Abruf ist es, der verhindert, dass der Fehler in zwei Wochen wieder
            auftaucht.
          </p>
        </section>
      )}

      {rated.length >= 3 && (
        <section>
          <SectionHead
            title="Selbsteinschätzung"
            hint="wie gut du dich kennst — die aussagekräftigste Einzelzahl über deinen Stand"
          />
          <div className="rounded-md border border-rule bg-surface px-5 py-5">
            <ul className="space-y-3">
              {calib.map((c) => (
                <li key={c.confidence} className="flex items-center gap-4">
                  <span className="w-[104px] shrink-0 text-[13px] text-muted">
                    {['Rate ich', 'Denke schon', 'Sicher'][c.confidence]}
                  </span>
                  <span className="h-4 min-w-0 flex-1 rounded-sm bg-canvas">
                    {c.n > 0 && (
                      <span
                        className={`block h-full rounded-sm ${
                          c.confidence === 2 && c.hit < 0.7 ? 'bg-neg' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.max(2, c.hit * 100)}%` }}
                      />
                    )}
                  </span>
                  <span className="w-[92px] shrink-0 text-right font-mono text-[11.5px] tabular-nums text-faint">
                    {c.n > 0 ? `${Math.round(c.hit * 100)} % · n=${c.n}` : '—'}
                  </span>
                </li>
              ))}
            </ul>

            <p className="pretty mt-4 max-w-prose border-t border-rule pt-4 text-[13px] leading-relaxed text-muted">
              {overconfident.length > 0 ? (
                <>
                  <span className="font-medium text-neg">
                    {overconfident.length}
                    {overconfident.length === 1 ? ' Aufgabe' : ' Aufgaben'}, bei {overconfident.length === 1 ? 'der' : 'denen'} du dir sicher warst,
                    {overconfident.length === 1 ? ' ging' : ' gingen'} daneben.
                  </span>{' '}
                  Das sind die gefährlichsten Lücken — sie fühlen sich nicht wie Lücken an. Sie stehen unten in der
                  Liste und kommen bevorzugt wieder.
                </>
              ) : calib[2].n > 0 && calib[2].hit >= 0.9 ? (
                <>Deine Einschätzung passt. Wo du «sicher» sagst, sitzt es auch — darauf kannst du dich verlassen.</>
              ) : (
                <>Noch zu wenige Daten für ein Urteil. Schätze in den nächsten Runden weiter ein.</>
              )}
            </p>
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Verlauf dieser Runde" />
        <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
          {scores.map((s) => (
            <li key={s.meta.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-[1px] ${
                  s.score >= 0.999 ? 'bg-pos' : s.score > 0 ? 'bg-oxide' : 'bg-neg'
                }`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{s.meta.title}</span>
              {s.retryScore !== undefined && (
                <span className={`tag ${s.retryScore >= 0.999 ? 'tag-ok' : 'tag-bad'}`}>
                  {s.retryScore >= 0.999 ? '2. Anlauf ok' : '2. Anlauf daneben'}
                </span>
              )}
              {s.confidence === 2 && s.score < LOOP_THRESHOLD && <span className="tag tag-bad">sicher gewesen</span>}
              <span className={`tag ${s.meta.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                {s.meta.lang === 'python' ? 'Py' : 'Java'}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-muted">
                {Math.round(s.score * s.meta.points * 10) / 10}/{s.meta.points} P
              </span>
            </li>
          ))}
        </ul>
      </section>

      {weakTopics.length > 0 && (
        <section>
          <SectionHead title="Das solltest du dir noch ansehen" />
          <ul className="space-y-2">
            {weakTopics.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-rule bg-surface px-4 py-3"
              >
                <Link href={`/themen/${t.id}`} className="text-[14.5px] font-medium hover:text-accent">
                  {t.title}
                </Link>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-faint">{t.lecture}</span>
                <div className="ml-auto flex gap-2">
                  <Link href={`/themen/${t.id}`} className="btn-quiet btn-sm">
                    Theorie
                  </Link>
                  <Link href={`/ueben?thema=${t.id}`} className="btn-secondary btn-sm">
                    Gezielt üben
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-rule pt-6">
        <button onClick={onAgain} className="btn-primary btn-lg">
          Nächste Runde
        </button>
        <Link href="/plan" className="btn-secondary">
          Zum Lernplan
        </Link>
        <Link href="/" className="btn-quiet">
          Zur Übersicht
        </Link>
      </div>
    </div>
  )
}

export { Meter }
