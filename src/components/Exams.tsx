'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { Loading, Reveal } from './ui'
import { Page } from './Shell'

export function ExamList() {
  const { ready, index, progress } = useStore()

  const best = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of progress.exams) {
      const pct = a.max > 0 ? a.total / a.max : 0
      if (!m.has(a.examId) || pct > m.get(a.examId)!) m.set(a.examId, pct)
    }
    return m
  }, [progress.exams])

  if (!ready || !index) {
    return (
      <Page title="Probeklausuren">
        <Loading />
      </Page>
    )
  }

  const originals = index.exams.filter((e) => e.origin === 'original')
  const generated = index.exams.filter((e) => e.origin !== 'original')

  return (
    <Page
      title="Probeklausuren"
      lead="Zuerst die beiden Originalklausuren des Lehrstuhls, danach beliebig viele neue Varianten nach demselben Bauplan."
    >
      <div className="space-y-9">
        <section>
          <h2 className="mb-1 text-[19px]">Originalklausuren</h2>
          <p className="mb-3 max-w-prose text-[13.5px] text-muted">
            Wortgleich aus den ausgeteilten Probeklausuren übernommen, inklusive Punkteverteilung.
          </p>
          <ul className="space-y-2">
            {originals.map((e, i) => (
              <Reveal key={e.id} index={i}>
                <ExamRow exam={e} best={best.get(e.id)} />
              </Reveal>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-[19px]">Generierte Klausuren</h2>
          <p className="mb-3 max-w-prose text-[13.5px] text-muted">
            Gleicher Bauplan, andere Aufgaben — bei jedem Start neu aus der Aufgabenbank gezogen. Damit kannst du das
            Format beliebig oft üben, ohne die Lösungen auswendig zu können.
          </p>
          <ul className="space-y-2">
            {generated.map((e, i) => (
              <Reveal key={e.id} index={i}>
                <ExamRow exam={e} best={best.get(e.id)} />
              </Reveal>
            ))}
          </ul>
        </section>

        {progress.exams.length > 0 && (
          <section>
            <h2 className="mb-3 text-[19px]">Deine Versuche</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-b border-lineStrong text-left text-[12px] uppercase tracking-[0.06em] text-faint">
                    <th className="py-2 pr-3 font-semibold">Datum</th>
                    <th className="py-2 pr-3 font-semibold">Klausur</th>
                    <th className="py-2 pr-3 text-right font-semibold">Punkte</th>
                    <th className="py-2 pr-3 text-right font-semibold">Prozent</th>
                    <th className="py-2 text-right font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.exams.slice(0, 15).map((a) => {
                    const meta = index.exams.find((e) => e.id === a.examId)
                    const pct = a.max > 0 ? Math.round((a.total / a.max) * 100) : 0
                    return (
                      <tr key={a.id} className="border-b border-line">
                        <td className="py-2 pr-3 tabnum text-muted">
                          {new Date(a.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="py-2 pr-3">{meta?.title ?? a.examId}</td>
                        <td className="py-2 pr-3 text-right tabnum">
                          {Math.round(a.total * 10) / 10} / {a.max}
                        </td>
                        <td className="py-2 pr-3 text-right tabnum">{pct} %</td>
                        <td className={`py-2 text-right tabnum font-medium ${pct >= 50 ? 'text-ok' : 'text-bad'}`}>
                          {a.grade ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Page>
  )
}

function ExamRow({
  exam,
  best,
}: {
  exam: { id: string; title: string; subtitle?: string; minutes: number; totalPoints: number; bonusPoints?: number; lang: string }
  best?: number
}) {
  return (
    <li>
      <Link
        href={`/klausur/${exam.id}`}
        className="panel-link block px-4 py-4 sm:flex sm:items-center sm:gap-5"
      >
        <div className="min-w-0 sm:flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14.5px] font-medium">{exam.title}</span>
            <span className={`tag ${exam.lang === 'python' ? 'tag-py' : exam.lang === 'java' ? 'tag-java' : ''}`}>
              {exam.lang === 'python' ? 'Python' : exam.lang === 'java' ? 'Java' : 'Gemischt'}
            </span>
          </div>
          {exam.subtitle && <div className="mt-1 text-[13px] text-muted">{exam.subtitle}</div>}
        </div>
        <div className="tabnum mt-2 flex shrink-0 items-center gap-4 text-[13px] text-muted sm:mt-0 sm:gap-5">
          <span>{exam.minutes} min</span>
          <span>
            {exam.totalPoints} P{exam.bonusPoints ? ` + ${exam.bonusPoints} Bonus` : ''}
          </span>
          <span
            className={`font-medium sm:w-16 sm:text-right ${
              best === undefined ? 'text-faint' : best >= 0.5 ? 'text-ok' : 'text-bad'
            }`}
          >
            {best === undefined ? 'neu' : `${Math.round(best * 100)} %`}
          </span>
        </div>
      </Link>
    </li>
  )
}
