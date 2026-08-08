'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { EXAM_DATE, TOPIC_BY_ID, TOPICS } from '@/content/topics'
import { useStore } from '@/lib/store'
import { daysUntil } from '@/lib/srs'
import { Dialog, Loading, Meter, Segmented } from './ui'
import { Page } from './Shell'

export function ProgressPage() {
  const { ready, index, progress, readiness, mastery, setSetting, downloadBackup, restoreBackup, resetAll, theme, setTheme } =
    useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge')
  const [resetOpen, setResetOpen] = useState(false)

  const days = useMemo(() => lastDays(progress.days, 30), [progress.days])
  const maxDone = Math.max(1, ...days.map((d) => d.done))
  const totalDone = Object.keys(progress.items).length
  const totalMinutes = Math.round(Object.values(progress.days).reduce((a, d) => a + d.minutes, 0))

  if (!ready || !index) {
    return (
      <Page title="Fortschritt">
        <Loading />
      </Page>
    )
  }

  const ranked = Object.values(mastery).sort((a, b) => b.riskPoints - a.riskPoints)

  return (
    <Page title="Fortschritt" lead="Was du bisher geschafft hast — und wo die Klausurpunkte gerade liegen bleiben.">
      {/* Kennzahlen */}
      <section className="panel grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-4">
        <div>
          <div className="eyebrow">Aufgaben bearbeitet</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {totalDone}
            <span className="text-[14px] font-normal text-muted"> / {index.total}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Lernzeit</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {totalMinutes < 90 ? totalMinutes : Math.round(totalMinutes / 6) / 10}
            <span className="text-[14px] font-normal text-muted">{totalMinutes < 90 ? ' min' : ' h'}</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Serie</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">
            {progress.streak.current}
            <span className="text-[14px] font-normal text-muted"> Tage</span>
          </div>
        </div>
        <div>
          <div className="eyebrow">Probeklausuren</div>
          <div className="tabnum mt-1 text-[26px] font-semibold leading-none">{progress.exams.length}</div>
        </div>
      </section>

      {/* Aktivität */}
      <section className="panel mt-4 px-5 py-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Die letzten 30 Tage</h2>
          <span className="text-[13px] text-muted">
            Tagesziel {progress.settings.dailyGoal} Aufgaben
          </span>
        </div>
        <div className="mt-4 flex h-[110px] items-end gap-[3px]">
          {days.map((d) => (
            <div key={d.date} className="group relative flex-1" title={`${d.label}: ${d.done} Aufgaben`}>
              <div
                className={`w-full rounded-sm transition-colors ${
                  d.done === 0 ? 'bg-line' : d.done >= progress.settings.dailyGoal ? 'bg-ok' : 'bg-accent/70'
                }`}
                style={{ height: `${Math.max(2, (d.done / maxDone) * 100)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-faint">
          <span>{days[0]?.label}</span>
          <span>heute</span>
        </div>
      </section>

      {/* Themen */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Themen nach Punkterisiko</h2>
          <span className="text-[13px] text-muted">
            Prognose {readiness.score} % · noch {Math.max(0, Math.floor(daysUntil(EXAM_DATE)))} Tage
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-lineStrong text-left text-[12px] uppercase tracking-[0.06em] text-faint">
                <th className="py-2 pr-3 font-semibold">Thema</th>
                <th className="py-2 pr-3 font-semibold">Beherrschung</th>
                <th className="py-2 pr-3 text-right font-semibold">gesehen</th>
                <th className="py-2 pr-3 text-right font-semibold">fällig</th>
                <th className="py-2 text-right font-semibold" title="Erwarteter Punktverlust in der Klausur">
                  Risiko
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((m) => {
                const t = TOPIC_BY_ID[m.topicId]
                if (!t) return null
                return (
                  <tr key={m.topicId} className="border-b border-line">
                    <td className="py-2 pr-3">
                      <Link href={`/themen/${m.topicId}`} className="hover:text-accent">
                        {t.title}
                      </Link>
                      <span className={`tag ml-2 ${t.lang === 'python' ? 'tag-py' : 'tag-java'}`}>
                        {t.lang === 'python' ? 'Py' : 'Java'}
                      </span>
                    </td>
                    <td className="w-[190px] py-2 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Meter
                          value={m.mastery}
                          tone={m.seen === 0 ? 'accent' : m.mastery >= 0.75 ? 'ok' : m.mastery >= 0.4 ? 'warn' : 'bad'}
                        />
                        <span className="tabnum w-9 shrink-0 text-right text-[12.5px] text-muted">
                          {m.seen ? `${Math.round(m.mastery * 100)}%` : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabnum text-muted">
                      {m.seen}/{m.total}
                    </td>
                    <td className="py-2 pr-3 text-right tabnum text-muted">{m.due || '—'}</td>
                    <td className="py-2 text-right tabnum">
                      <span className={m.riskPoints > 2 ? 'text-bad' : m.riskPoints > 1 ? 'text-warn' : 'text-muted'}>
                        {m.riskPoints.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12.5px] text-faint">
          Risiko = Klausurgewicht des Themas × erwartete Wissenslücke am Prüfungstag, in Prozentpunkten der Gesamtklausur.
        </p>
      </section>

      {/* Einstellungen */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="panel px-5 py-5">
          <h2 className="text-[15px] font-semibold">Einstellungen</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-[13.5px]">Tagesziel</span>
              <Segmented
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
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13.5px]">Aktuelles Schema</span>
              <span className="text-[13px] text-muted">{theme === 'dark' ? 'dunkel' : 'hell'}</span>
            </div>
          </div>
        </div>

        <div className="panel px-5 py-5">
          <h2 className="text-[15px] font-semibold">Lernstand sichern</h2>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Dein Fortschritt liegt ausschließlich in diesem Browser. Für einen zweiten Rechner — oder als Sicherheitsnetz
            — lädst du ihn hier als Datei herunter und spielst ihn dort wieder ein.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={downloadBackup} className="btn-secondary">
              Sicherung herunterladen
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-secondary">
              Sicherung einspielen
            </button>
            <Segmented
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
          <div className="mt-5 border-t border-line pt-4">
            <button onClick={() => setResetOpen(true)} className="btn-danger btn-sm">
              Alles zurücksetzen
            </button>
          </div>
        </div>
      </section>

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
        <p className="text-[14px]">
          Alle Ergebnisse, Wiederholungstermine und Klausurversuche werden gelöscht. Das lässt sich nicht rückgängig
          machen — lade vorher eine Sicherung herunter, wenn du dir nicht sicher bist.
        </p>
      </Dialog>
    </Page>
  )
}

function lastDays(days: Record<string, { done: number; minutes: number; correct: number }>, n: number) {
  const out: { date: string; label: string; done: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    out.push({
      date: iso,
      label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      done: days[iso]?.done ?? 0,
    })
  }
  return out
}

export { TOPICS }
