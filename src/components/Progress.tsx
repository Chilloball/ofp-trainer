'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { EXAM_DATE, TOPICS, TOPIC_BY_ID, examWeight } from '@/content/topics'
import type { SessionLog } from '@/lib/types'
import { useStore } from '@/lib/store'
import { calendarDaysUntil, lastDayKeys } from '@/lib/day'
import { AnimatedNumber, Dialog, Loading, Reveal, Segmented } from './ui'
import { ActivityCalendar, Meter, PointsBar, Ring, Sparkline, toneFor } from './viz'
import { Page } from './Shell'

export function ProgressPage() {
  const {
    ready, index, progress, readiness, mastery,
    setSetting, downloadBackup, restoreBackup, resetAll, theme, setTheme,
  } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge')
  const [resetOpen, setResetOpen] = useState(false)

  const totalDone = Object.keys(progress.items).length
  const totalMinutes = Math.round(Object.values(progress.days).reduce((a, d) => a + d.minutes, 0))
  const last14 = useMemo(() => lastDays(progress.days, 14), [progress.days])

  const segments = useMemo(
    () =>
      TOPICS.map((t) => ({
        id: t.id,
        title: t.title,
        weight: examWeight(t.id),
        mastery: mastery[t.id]?.mastery ?? 0,
        lang: t.lang,
      })).sort((a, b) => (a.lang === b.lang ? b.weight - a.weight : a.lang === 'python' ? -1 : 1)),
    [mastery],
  )

  if (!ready || !index) {
    return (
      <Page title="Fortschritt">
        <Loading lines={5} />
      </Page>
    )
  }

  const ranked = Object.values(mastery).sort((a, b) => b.riskPoints - a.riskPoints)
  const enoughData = readiness.coverage >= 8
  const daysLeft = Math.max(0, calendarDaysUntil(EXAM_DATE))

  return (
    <Page
      eyebrow="Lernstand"
      title="Fortschritt"
      lead="Was du bisher geschafft hast — und wo die Klausurpunkte gerade liegen bleiben."
      meta={[
        { label: 'Prognose', value: enoughData ? `${readiness.score} % · Note ${readiness.grade}` : 'noch zu wenig Daten' },
        { label: 'Aufgaben gesehen', value: `${totalDone} / ${index.total}` },
        { label: 'Serie', value: `${progress.streak.current} ${progress.streak.current === 1 ? 'Tag' : 'Tage'}` },
        { label: 'Tage bis zur Klausur', value: daysLeft },
      ]}
    >
      {/* ------------------------------ Überblick ------------------------------ */}
      <Reveal>
        <section className="panel flex flex-col gap-8 p-6 sm:p-7 lg:flex-row lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <Ring
              value={enoughData ? readiness.score / 100 : readiness.coverage / 100}
              size={164}
              tone={enoughData ? toneFor(readiness.score / 100) : 'accent'}
              arcs={
                enoughData
                  ? [
                      { value: readiness.python / 100, tone: 'accent', label: 'Python' },
                      { value: readiness.java / 100, tone: 'oxide', label: 'Java' },
                    ]
                  : []
              }
            >
              <div>
                <div className="numeral text-[36px] leading-none">
                  <AnimatedNumber value={enoughData ? readiness.score : readiness.coverage} />
                  <span className="text-[20px]">%</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.09em] text-faint">
                  {enoughData ? `Note ${readiness.grade}` : 'gesehen'}
                </div>
              </div>
            </Ring>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            <div>
              <div className="eyebrow">Aufgaben</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={totalDone} />
                <span className="text-[14px] text-muted"> / {index.total}</span>
              </div>
              <Meter value={totalDone / Math.max(1, index.total)} tone="accent" className="mt-2.5" />
            </div>
            <div>
              <div className="eyebrow">Lernzeit</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber
                  value={totalMinutes < 90 ? totalMinutes : Math.round(totalMinutes / 6) / 10}
                  decimals={totalMinutes < 90 ? 0 : 1}
                />
                <span className="text-[14px] text-muted">{totalMinutes < 90 ? ' min' : ' h'}</span>
              </div>
              <div className="mt-1.5 h-[26px]">
                <Sparkline values={last14.map((d) => d.done)} tone="accent" width={112} height={26} />
              </div>
            </div>
            <div>
              <div className="eyebrow">Serie</div>
              <div className="numeral mt-1.5 text-[26px] leading-none text-accent">
                <AnimatedNumber value={progress.streak.current} />
                <span className="text-[14px] text-muted"> {progress.streak.current === 1 ? 'Tag' : 'Tage'}</span>
              </div>
              <div className="mt-2.5 text-[12px] text-faint">Bestwert {progress.streak.best}</div>
            </div>
            <div>
              <div className="eyebrow">Probeklausuren</div>
              <div className="numeral mt-1.5 text-[26px] leading-none">
                <AnimatedNumber value={progress.exams.length} />
              </div>
              <div className="mt-2.5 text-[12px] text-faint">noch {daysLeft} Tage</div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* --------------------------- Punkte in der Klausur --------------------------- */}
      <Reveal index={1} className="mt-6">
        <section className="panel px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[17px]">Die Klausur als eine Leiste</h2>
            <span className="text-[13px] text-faint">jedes Feld ein Thema, so breit wie sein Punkteanteil</span>
          </div>
          <PointsBar segments={segments} />
        </section>
      </Reveal>

      {/* ---------------------------- Selbsteinschätzung ---------------------------- */}
      <Calibration log={progress.log} />

      {/* ------------------------------ Regelmäßigkeit ------------------------------ */}
      <Reveal index={2} className="mt-6">
        <section className="panel px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[17px]">Regelmäßigkeit</h2>
            <span className="text-[13px] text-faint">zwanzig Wochen — verteiltes Lernen schlägt lange Blöcke</span>
          </div>
          <ActivityCalendar days={progress.days} weeks={20} goal={progress.settings.dailyGoal} />
        </section>
      </Reveal>

      {/* --------------------------------- Themen --------------------------------- */}
      <Reveal index={3} className="mt-10">
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[19px]">Themen nach Punkterisiko</h2>
            <span className="text-[13px] text-faint">Klausurgewicht × erwartete Lücke am Prüfungstag</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-ruleStrong text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                  <th className="py-2.5 pr-3 font-semibold">Thema</th>
                  <th className="py-2.5 pr-3 font-semibold">Beherrschung</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">gesehen</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">fällig</th>
                  <th className="py-2.5 text-right font-semibold">Risiko</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((m, i) => {
                  const t = TOPIC_BY_ID[m.topicId]
                  if (!t) return null
                  return (
                    <tr key={m.topicId} className="border-b border-rule transition-colors hover:bg-raised/60">
                      <td className="py-2.5 pr-3">
                        <Link href={`/themen/${m.topicId}`} className="hover:text-accent">
                          {t.title}
                        </Link>
                        <span className={`tag ml-2 ${t.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                          {t.lang === 'python' ? 'Py' : 'Java'}
                        </span>
                      </td>
                      <td className="w-[190px] py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Meter value={m.mastery} tone={toneFor(m.mastery, m.seen > 0)} delay={i * 0.02} />
                          <span className="tabnum w-9 shrink-0 text-right text-[12.5px] text-muted">
                            {m.seen ? `${Math.round(m.mastery * 100)}%` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabnum text-muted">
                        {m.seen}/{m.total}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabnum text-muted">{m.due || '—'}</td>
                      <td className="py-2.5 text-right tabnum">
                        <span
                          className={
                            m.riskPoints > 2 ? 'font-medium text-neg' : m.riskPoints > 1 ? 'text-oxide' : 'text-muted'
                          }
                        >
                          {m.riskPoints.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[12.5px] text-faint">
            Das Risiko sagt: So viele Prozentpunkte der Gesamtklausur gehen bei diesem Thema voraussichtlich verloren,
            wenn du nichts änderst.
          </p>
        </section>
      </Reveal>

      {/* ------------------------------ Einstellungen ------------------------------ */}
      <Reveal index={4} className="mt-12">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel px-5 py-5">
            <h2 className="text-[17px]">Einstellungen</h2>
            <div className="mt-4 space-y-4">
              <label className="flex items-center justify-between gap-4">
                <span className="text-[13.5px]">Tagesziel</span>
                <Segmented
                  name="ziel"
                  size="sm"
                  value={String(progress.settings.dailyGoal)}
                  onChange={(v) => setSetting('dailyGoal', Number(v))}
                  options={[
                    { value: '5', label: '5' },
                    { value: '10', label: '10' },
                    { value: '15', label: '15' },
                    { value: '25', label: '25' },
                  ]}
                />
              </label>
              <label className="flex items-center justify-between gap-4">
                <span className="text-[13.5px]">Farbschema</span>
                <Segmented
                  name="schema"
                  size="sm"
                  value={progress.settings.theme}
                  onChange={(v) => setTheme(v)}
                  options={[
                    { value: 'system', label: 'System' },
                    { value: 'light', label: 'Hell' },
                    { value: 'dark', label: 'Dunkel' },
                  ]}
                />
              </label>
              <div className="flex items-center justify-between gap-4 border-t border-rule pt-3.5">
                <span className="text-[13.5px] text-muted">gerade aktiv</span>
                <span className="text-[13px] text-muted">{theme === 'dark' ? 'dunkel' : 'hell'}</span>
              </div>
            </div>
          </section>

          <section className="panel px-5 py-5">
            <h2 className="text-[17px]">Lernstand sichern</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Dein Fortschritt liegt ausschließlich in diesem Browser. Für einen zweiten Rechner — oder als
              Sicherheitsnetz — lädst du ihn hier als Datei herunter und spielst ihn dort wieder ein.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={downloadBackup} className="btn-secondary">
                Sicherung herunterladen
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary">
                Sicherung einspielen
              </button>
              <Segmented
                name="restore"
                size="sm"
                value={restoreMode}
                onChange={setRestoreMode}
                options={[
                  { value: 'merge', label: 'zusammenführen', title: 'Neuere Ergebnisse gewinnen' },
                  { value: 'replace', label: 'ersetzen', title: 'Aktuellen Stand verwerfen' },
                ]}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void restoreBackup(f, restoreMode)
                e.target.value = ''
              }}
            />
            <div className="mt-5 border-t border-rule pt-4">
              <button onClick={() => setResetOpen(true)} className="btn-danger btn-sm">
                Alles zurücksetzen
              </button>
            </div>
          </section>
        </div>
      </Reveal>

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Lernstand vollständig löschen?"
        footer={
          <>
            <button onClick={() => setResetOpen(false)} className="btn-secondary">
              Abbrechen
            </button>
            <button
              onClick={() => {
                void resetAll()
                setResetOpen(false)
              }}
              className="btn-danger"
            >
              Endgültig löschen
            </button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed">
          Alle Ergebnisse, Wiederholungstermine und Klausurversuche werden gelöscht. Das lässt sich nicht rückgängig
          machen — lade vorher eine Sicherung herunter, wenn du dir nicht sicher bist.
        </p>
      </Dialog>
    </Page>
  )
}

function lastDays(days: Record<string, { done: number }>, n: number) {
  return lastDayKeys(n).map((key) => ({ date: key, done: days[key]?.done ?? 0 }))
}

/* ==================================================================== *
 *  Selbsteinschätzung (Kalibrierung)
 *
 *  Die Frage ist nicht „wie viel kannst du", sondern „weißt du, was du
 *  kannst". Der Abstand zwischen der eigenen Sicherheit und der
 *  tatsächlichen Trefferquote ist die aussagekräftigste Einzelzahl über
 *  den Lernstand — und die einzige, die erklärt, warum jemand aus einer
 *  Klausur kommt und sagt: „Ich dachte, ich hätte das gekonnt."
 * ==================================================================== */

const CONF_LABEL = ['Rate ich', 'Denke schon', 'Sicher']

function Calibration({ log }: { log: SessionLog[] }) {
  const rows = useMemo(() => {
    const rated = log.filter((l) => l.confidence !== undefined)
    return [0, 1, 2].map((c) => {
      const inBucket = rated.filter((l) => l.confidence === c)
      return {
        c,
        n: inBucket.length,
        hit: inBucket.length ? inBucket.filter((l) => l.score >= 0.999).length / inBucket.length : 0,
      }
    })
  }, [log])

  const rated = rows.reduce((a, r) => a + r.n, 0)
  if (rated < 10) return null

  /* Erwartungswert je Stufe: „sicher" sollte um 90 % treffen, „denke
     schon" um 65 %, „rate ich" um 25 %. Größere Abweichungen nach unten
     sind Selbstüberschätzung. */
  const EXPECTED = [0.25, 0.65, 0.9]
  const gap = rows[2].n > 0 ? EXPECTED[2] - rows[2].hit : 0

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[19px]">Kennst du dich selbst?</h2>
        <span className="text-[13px] text-faint">
          Sicherheitseinschätzung vor dem Prüfen gegen die tatsächliche Trefferquote
        </span>
      </div>

      <div className="rounded-md border border-rule bg-surface px-5 py-5 sm:px-6">
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.c} className="flex items-center gap-4">
              <span className="w-[104px] shrink-0 text-[13px] text-muted">{CONF_LABEL[r.c]}</span>
              <span className="relative h-5 min-w-0 flex-1 rounded-sm bg-canvas">
                {r.n > 0 && (
                  <span
                    className={`block h-full rounded-sm ${r.c === 2 && r.hit < 0.75 ? 'bg-neg' : 'bg-accent'}`}
                    style={{ width: `${Math.max(1.5, r.hit * 100)}%` }}
                  />
                )}
                {/* Sollmarke */}
                <span
                  className="absolute inset-y-0 w-px bg-ink/45"
                  style={{ left: `${EXPECTED[r.c] * 100}%` }}
                  title={`erwartet: ${Math.round(EXPECTED[r.c] * 100)} %`}
                />
              </span>
              <span className="w-[104px] shrink-0 text-right font-mono text-[11.5px] tabular-nums text-faint">
                {r.n > 0 ? `${Math.round(r.hit * 100)} % · n=${r.n}` : '—'}
              </span>
            </li>
          ))}
        </ul>

        <p className="pretty mt-5 max-w-prose border-t border-rule pt-4 text-[13.5px] leading-relaxed text-muted">
          Der senkrechte Strich ist der Sollwert. {' '}
          {rows[2].n < 5 ? (
            <>Für ein Urteil über die Stufe «Sicher» fehlen noch ein paar Einschätzungen.</>
          ) : gap > 0.18 ? (
            <>
              <span className="font-medium text-neg">Du überschätzt dich.</span> Wo du «sicher» sagst, stimmt es nur
              in {Math.round(rows[2].hit * 100)} % der Fälle. Das ist die gefährlichste Art von Lücke, weil sie sich
              nicht wie eine anfühlt — nimm die Aufgaben ernst, bei denen der Trainer dich darauf hinweist.
            </>
          ) : gap < -0.08 ? (
            <>
              <span className="font-medium text-pos">Du unterschätzt dich.</span> Du triffst häufiger, als du dir
              zutraust. In der Klausur heißt das: bei der ersten Idee bleiben, statt sie wegzuwerfen.
            </>
          ) : (
            <>
              <span className="font-medium text-pos">Deine Einschätzung passt.</span> Du weißt ziemlich genau, was du
              kannst — darauf kannst du dich in der Klausur beim Einteilen der Zeit verlassen.
            </>
          )}
        </p>
      </div>
    </section>
  )
}
