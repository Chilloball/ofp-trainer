'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TOPICS } from '@/content/topics'
import { Segmented } from './ui'
import { Page } from './Shell'

/* ==================================================================== *
 *  Kursmaterial
 *
 *  Die Originaldateien (Folien, Aufgabenblätter, Aufzeichnungen) gehören
 *  dem Lehrstuhl und werden hier nicht mitgeliefert. Diese Seite ordnet
 *  sie den Themen zu, damit man beim Nachschlagen sofort weiß, wo man
 *  suchen muss.
 * ==================================================================== */

interface Item {
  file: string
  kind: 'Folien' | 'Aufgaben' | 'Klausurmaterial' | 'Quellcode' | 'Notebook' | 'Aufzeichnung'
  lang: 'python' | 'java' | 'beide'
  title: string
  note?: string
}

const MATERIAL: Item[] = [
  { file: 'OFP -- Einleitung_SoSe26.pdf', kind: 'Folien', lang: 'beide', title: 'Einleitung und Organisatorisches', note: 'Ablauf, Prüfungsform, Literatur' },
  { file: '1_installation_variablen_anweisungen_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 1 — Installation, Variablen, Anweisungen' },
  { file: '1_if_else_while_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 1 — Verzweigungen und Schleifen' },
  { file: '1_strings_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 1 — Zeichenketten' },
  { file: '2_functions_and_comments_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 2 — Funktionen und Kommentare' },
  { file: '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 3 — Mutability, Geltungsbereiche, Motivation FP' },
  { file: '4_func_programming_and_recursion_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 4 — Funktionale Programmierung und Rekursion' },
  { file: '5_map_filter_reduce_wrapup_26.pdf', kind: 'Folien', lang: 'python', title: 'VL 5 — map, filter, reduce' },
  { file: 'end_summary_python_26.pdf', kind: 'Folien', lang: 'python', title: 'Zusammenfassung Python', note: 'Enthält die Liste klausurrelevanter Befehle' },
  { file: 'OFP_Java.pdf', kind: 'Folien', lang: 'java', title: 'Java-Skript (vollständig)', note: 'Kapitel 1–8 sind klausurrelevant; Überblick ab S. 347' },
  { file: 'Beispielaufgaben_VL0_undVL1.pdf', kind: 'Aufgaben', lang: 'python', title: 'Beispielaufgaben VL 0 und 1' },
  { file: 'Beispielaufgaben_VL2.pdf', kind: 'Aufgaben', lang: 'python', title: 'Beispielaufgaben VL 2' },
  { file: 'Beispielaufgaben_VL3.pdf', kind: 'Aufgaben', lang: 'python', title: 'Beispielaufgaben VL 3' },
  { file: 'blatt4u5.pdf', kind: 'Aufgaben', lang: 'python', title: 'Übungsblatt 4 und 5' },
  { file: 'Aufgaben_Objekte_Klassen_UML.pdf', kind: 'Aufgaben', lang: 'java', title: 'Objekte, Klassen und UML' },
  { file: 'PushYourLuck_Aufgaben_und_Loesungen.pdf', kind: 'Aufgaben', lang: 'python', title: 'Push Your Luck — Aufgaben mit Lösungen' },
  { file: 'Probeklausur_Python_ausfuellbar.pdf', kind: 'Klausurmaterial', lang: 'python', title: 'Probeklausur Python', note: 'In dieser App vollständig nachgebaut' },
  { file: 'Probeklausur_Java_ausfuellbar.pdf', kind: 'Klausurmaterial', lang: 'java', title: 'Probeklausur Java', note: 'In dieser App vollständig nachgebaut' },
  { file: 'ofp_beispielfragen_mit_antworten.pdf', kind: 'Klausurmaterial', lang: 'beide', title: 'Beispielfragen mit Antworten' },
  { file: 'goofspiel26*.py', kind: 'Quellcode', lang: 'python', title: 'Goofspiel — imperativ und funktional', note: 'Die Beispiele aus der letzten Vorlesung' },
  { file: 'helper*.py', kind: 'Quellcode', lang: 'python', title: 'Hilfsfunktionen zum Goofspiel' },
  { file: 'ofp-2/', kind: 'Quellcode', lang: 'java', title: 'Java-Beispiele des Lehrstuhls', note: 'Kapitelweise sortiert, von 01_JavaProgramme bis 11_Ueberblick' },
  { file: 'pythonvorlesung_0*.ipynb', kind: 'Notebook', lang: 'python', title: 'Notebooks zu den Vorlesungen 2–7' },
  { file: 'zusammenfassung.ipynb', kind: 'Notebook', lang: 'python', title: 'Zusammenfassung als Notebook' },
  { file: 'final_lecture_examples.ipynb', kind: 'Notebook', lang: 'python', title: 'Beispiele der letzten Vorlesung' },
  { file: '2025-05-12 11-14-15.mkv', kind: 'Aufzeichnung', lang: 'python', title: 'Vorlesungsaufzeichnung, Teil 1' },
  { file: '2025-05-12 12-06-29.mkv', kind: 'Aufzeichnung', lang: 'python', title: 'Vorlesungsaufzeichnung, Teil 2' },
]

export function Material() {
  const [lang, setLang] = useState<'alle' | 'python' | 'java'>('alle')
  const [q, setQ] = useState('')

  const grouped = useMemo(() => {
    const filtered = MATERIAL.filter(
      (m) =>
        (lang === 'alle' || m.lang === lang || m.lang === 'beide') &&
        (q === '' ||
          [m.title, m.file, m.note ?? ''].some((s) => s.toLowerCase().includes(q.toLowerCase()))),
    )
    const map = new Map<string, Item[]>()
    for (const m of filtered) {
      if (!map.has(m.kind)) map.set(m.kind, [])
      map.get(m.kind)!.push(m)
    }
    return [...map.entries()]
  }, [lang, q])

  const sourceIndex = useMemo(() => {
    const map = new Map<string, { topicId: string; title: string; page?: number; label?: string }[]>()
    for (const t of TOPICS) {
      for (const s of t.sources ?? []) {
        if (!map.has(s.file)) map.set(s.file, [])
        map.get(s.file)!.push({ topicId: t.id, title: t.title, page: s.page, label: s.label })
      }
    }
    return map
  }, [])

  return (
    <Page
      title="Kursmaterial"
      lead="Welche Datei welches Thema abdeckt. Die Dateien selbst liegen in deinem OFP-Ordner — sie gehören dem Lehrstuhl und werden hier nicht mitgeliefert."
      actions={
        <Segmented
          value={lang}
          onChange={setLang}
          options={[
            { value: 'alle', label: 'Alle' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
          ]}
        />
      }
    >
      <input
        className="field mb-6 max-w-sm"
        placeholder="Suchen …"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
      />

      <div className="space-y-8">
        {grouped.map(([kind, items]) => (
          <section key={kind}>
            <h2 className="mb-3 text-[19px]">{kind}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {items.map((m) => {
                const topics = sourceIndex.get(m.file) ?? []
                return (
                  <li key={m.file} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[14.5px] font-medium">{m.title}</span>
                      <span className={`tag ${m.lang === 'python' ? 'tag-py' : m.lang === 'java' ? 'tag-java' : ''}`}>
                        {m.lang === 'beide' ? 'Beides' : m.lang === 'python' ? 'Python' : 'Java'}
                      </span>
                      <code className="ml-auto font-mono text-[12px] text-faint">{m.file}</code>
                    </div>
                    {m.note && <p className="mt-1 text-[13px] text-muted">{m.note}</p>}
                    {topics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                        <span className="text-faint">Themen:</span>
                        {topics.slice(0, 8).map((t, i) => (
                          <Link key={i} href={`/themen/${t.topicId}`} className="text-accent hover:underline">
                            {t.title}
                            {t.page ? ` (S. ${t.page})` : ''}
                          </Link>
                        ))}
                        {topics.length > 8 && <span className="text-faint">und {topics.length - 8} weitere</span>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  )
}
