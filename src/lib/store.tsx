'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import type { ContentIndex, ExamAttempt, ExerciseMeta, ItemState, Settings, UserProgress } from './types'
import { EXAM_DATE, TOPIC_BY_ID } from '@/content/topics'
import { daysUntil, newItemState, review, scoreToGrade } from './srs'
import { readiness as computeReadiness, topicMastery, type Readiness, type TopicMastery } from './mastery'
import { loadIndex } from './content'
import {
  backupFilename, clearProgress, emptyProgress, exportProgress, getStorageError, importProgress,
  installUnloadFlush, loadProgress, mergeProgress, saveProgress,
} from './storage'

/* ==================================================================== *
 *  Zentraler Zustand der App
 *
 *  Alles läuft im Browser: Aufgabenindex + persönlicher Lernstand.
 *  Kein Login, kein Server — und trotzdem bleibt der Fortschritt beim
 *  nächsten Öffnen erhalten.
 * ==================================================================== */

export interface AnswerRecord {
  /** 0..1 */
  score: number
  ms: number
  usedHints: number
  revealed: boolean
}

export interface Toast {
  id: number
  msg: string
  kind: 'ok' | 'bad' | 'info'
}

interface StoreValue {
  ready: boolean
  /** true, solange noch nie eine Aufgabe gelöst wurde */
  isNew: boolean
  progress: UserProgress
  index: ContentIndex | null
  loadError: string | null
  storageError: string | null

  metaById: Map<string, ExerciseMeta>
  metaByTopic: Record<string, ExerciseMeta[]>
  readiness: Readiness
  mastery: Record<string, TopicMastery>
  todayCount: number
  dueCount: number

  recordAnswer(meta: ExerciseMeta, r: AnswerRecord): ItemState
  recordExam(attempt: ExamAttempt): void
  setName(name: string): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  toggleFlag(id: string, topicId: string): void
  toggleStar(id: string, topicId: string): void
  setScratch(lang: 'python' | 'java', code: string): void
  resetAll(): Promise<void>
  resetTopic(topicId: string): void
  downloadBackup(): void
  restoreBackup(file: File, mode: 'replace' | 'merge'): Promise<void>

  theme: 'light' | 'dark'
  setTheme(t: 'light' | 'dark' | 'system'): void
  toasts: Toast[]
  toast(msg: string, kind?: Toast['kind']): void
}

const Ctx = createContext<StoreValue | null>(null)

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden')
  return v
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function yesterday() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<UserProgress>(() => emptyProgress())
  const [index, setIndex] = useState<ContentIndex | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [systemDark, setSystemDark] = useState(false)
  const toastSeq = useRef(0)

  /* ------------------------------ Laden ------------------------------ */
  useEffect(() => {
    installUnloadFlush()
    let alive = true
    ;(async () => {
      const [stored, idx] = await Promise.all([
        loadProgress().catch(() => null),
        loadIndex().catch((e: Error) => {
          if (alive) setLoadError(e.message)
          return null
        }),
      ])
      if (!alive) return
      if (stored) setProgress(stored)
      if (idx) setIndex(idx)
      setReady(true)
    })()

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => {
      alive = false
      mq.removeEventListener('change', onChange)
    }
  }, [])

  /* ---------------------------- Speichern ---------------------------- */
  const commit = useCallback((next: UserProgress, immediate = false) => {
    setProgress(next)
    saveProgress(next, immediate)
    const err = getStorageError()
    if (err) setStorageError(err)
    return next
  }, [])

  /* ------------------------------ Theme ------------------------------ */
  const theme: 'light' | 'dark' =
    progress.settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : progress.settings.theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  /* ---------------------------- Ableitungen ---------------------------- */
  const metaById = useMemo(() => new Map((index?.items ?? []).map((i) => [i.id, i])), [index])

  const metaByTopic = useMemo(() => {
    const out: Record<string, ExerciseMeta[]> = {}
    for (const i of index?.items ?? []) (out[i.topicId] ??= []).push(i)
    return out
  }, [index])

  const mastery = useMemo(
    () => (index ? topicMastery(progress, metaByTopic) : {}),
    [progress, metaByTopic, index],
  )

  const readiness = useMemo(
    () =>
      index
        ? computeReadiness(progress, metaByTopic)
        : {
            score: 0, current: 0, python: 0, java: 0, grade: '5.0', quickWin: 0,
            coverage: 0, daysToExam: Math.ceil(Math.max(0, daysUntil(EXAM_DATE))), risks: [],
          },
    [progress, metaByTopic, index],
  )

  const todayCount = progress.days[today()]?.done ?? 0

  const dueCount = useMemo(() => {
    const now = Date.now()
    let n = 0
    for (const st of Object.values(progress.items)) if (st.reps > 0 && st.due <= now) n++
    return n
  }, [progress.items])

  const isNew = !progress.settings.onboarded && Object.keys(progress.items).length === 0

  /* ------------------------------ Aktionen ------------------------------ */

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastSeq.current
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const recordAnswer = useCallback(
    (meta: ExerciseMeta, r: AnswerRecord): ItemState => {
      const now = Date.now()
      const prev = progress.items[meta.id] ?? newItemState(meta.id, meta.topicId)
      const targetMs = 25_000 + meta.difficulty * 20_000
      const grade = scoreToGrade(r.score, {
        usedHints: r.usedHints,
        revealed: r.revealed,
        slow: r.ms > targetMs,
      })
      const next = review(prev, grade, {
        now,
        score: r.score,
        ms: r.ms,
        daysToExam: Math.max(0, daysUntil(EXAM_DATE, now)),
      })

      const day = today()
      const dayStat = progress.days[day] ?? { done: 0, minutes: 0, correct: 0 }
      const streak = { ...progress.streak }
      if (streak.lastDay !== day) {
        streak.current = streak.lastDay === yesterday() ? streak.current + 1 : 1
        streak.best = Math.max(streak.best, streak.current)
        streak.lastDay = day
      }

      const topicPrev = progress.topics[meta.topicId] ?? {
        topicId: meta.topicId, mastery: 0, seen: 0, correct: 0, attempts: 0, lastPracticed: null, speed: 1,
      }

      commit({
        ...progress,
        items: { ...progress.items, [meta.id]: next },
        topics: {
          ...progress.topics,
          [meta.topicId]: {
            ...topicPrev,
            attempts: topicPrev.attempts + 1,
            correct: topicPrev.correct + (r.score >= 0.999 ? 1 : 0),
            seen: prev.reps === 0 ? topicPrev.seen + 1 : topicPrev.seen,
            lastPracticed: now,
            speed: topicPrev.speed * 0.8 + (r.ms / targetMs) * 0.2,
          },
        },
        days: {
          ...progress.days,
          [day]: {
            done: dayStat.done + 1,
            minutes: dayStat.minutes + r.ms / 60_000,
            correct: dayStat.correct + (r.score >= 0.999 ? 1 : 0),
          },
        },
        streak,
        log: [
          { t: now, exerciseId: meta.id, topicId: meta.topicId, score: r.score, ms: r.ms, usedHints: r.usedHints, revealed: r.revealed },
          ...progress.log,
        ].slice(0, 800),
      })
      return next
    },
    [progress, commit],
  )

  const recordExam = useCallback(
    (attempt: ExamAttempt) => {
      commit({ ...progress, exams: [attempt, ...progress.exams].slice(0, 60) }, true)
    },
    [progress, commit],
  )

  const setName = useCallback((name: string) => commit({ ...progress, name: name.trim() }, true), [progress, commit])

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      commit({ ...progress, settings: { ...progress.settings, [key]: value } }, true)
    },
    [progress, commit],
  )

  const setTheme = useCallback((t: 'light' | 'dark' | 'system') => setSetting('theme', t), [setSetting])

  const toggleMark = useCallback(
    (id: string, topicId: string, field: 'flagged' | 'starred') => {
      const prev = progress.items[id] ?? newItemState(id, topicId)
      commit({ ...progress, items: { ...progress.items, [id]: { ...prev, [field]: !prev[field] } } })
    },
    [progress, commit],
  )

  const toggleFlag = useCallback((id: string, t: string) => toggleMark(id, t, 'flagged'), [toggleMark])
  const toggleStar = useCallback((id: string, t: string) => toggleMark(id, t, 'starred'), [toggleMark])

  const setScratch = useCallback(
    (lang: 'python' | 'java', code: string) => {
      commit({ ...progress, scratch: { ...progress.scratch, [lang]: code } })
    },
    [progress, commit],
  )

  const resetAll = useCallback(async () => {
    await clearProgress()
    const fresh = emptyProgress(progress.name)
    commit(fresh, true)
    toast('Lernstand zurückgesetzt.', 'ok')
  }, [progress.name, commit, toast])

  const resetTopic = useCallback(
    (topicId: string) => {
      const items = { ...progress.items }
      let n = 0
      for (const [id, st] of Object.entries(items)) {
        if (st.topicId === topicId) {
          delete items[id]
          n++
        }
      }
      const topics = { ...progress.topics }
      delete topics[topicId]
      commit({ ...progress, items, topics }, true)
      toast(`${n} Aufgaben in «${TOPIC_BY_ID[topicId]?.title ?? topicId}» zurückgesetzt.`, 'ok')
    },
    [progress, commit, toast],
  )

  const downloadBackup = useCallback(() => {
    const blob = exportProgress(progress)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename(progress)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Sicherung gespeichert.', 'ok')
  }, [progress, toast])

  const restoreBackup = useCallback(
    async (file: File, mode: 'replace' | 'merge') => {
      try {
        const loaded = await importProgress(file)
        const next = mode === 'merge' ? mergeProgress(progress, loaded) : loaded
        commit(next, true)
        toast(mode === 'merge' ? 'Lernstände zusammengeführt.' : 'Lernstand wiederhergestellt.', 'ok')
      } catch (e) {
        toast((e as Error).message, 'bad')
      }
    },
    [progress, commit, toast],
  )

  const value: StoreValue = {
    ready, isNew, progress, index, loadError, storageError,
    metaById, metaByTopic, readiness, mastery, todayCount, dueCount,
    recordAnswer, recordExam, setName, setSetting, toggleFlag, toggleStar, setScratch,
    resetAll, resetTopic, downloadBackup, restoreBackup,
    theme, setTheme, toasts, toast,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
