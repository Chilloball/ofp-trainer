import type { ContentIndex, Exam, Exercise, ExerciseMeta } from './types'
import { BASE_PATH } from './paths'

/* ==================================================================== *
 *  Content wird als statische Dateien geladen (public/content/).
 *
 *  Der Index (~95 KB) kommt beim Start, die vollständigen Aufgaben
 *  eines Themas erst, wenn sie gebraucht werden. So bleibt der erste
 *  Seitenaufbau schnell, obwohl 2 MB Aufgaben bereitstehen.
 * ==================================================================== */

const BASE = `${BASE_PATH}/content`

let indexPromise: Promise<ContentIndex> | null = null
/** Aus dem Index; hängt an allen weiteren Anfragen und verhindert, dass
    nach einem Update alte Dateien aus dem Browsercache kommen. */
let stamp = ''
const topicCache = new Map<string, Promise<Exercise[]>>()
const examCache = new Map<string, Promise<Exam>>()
const theoryCache = new Map<string, Promise<string | null>>()

async function getJson<T>(url: string, cache: RequestCache = 'default'): Promise<T> {
  const res = await fetch(url, { cache })
  if (!res.ok) throw new Error(`${url} konnte nicht geladen werden (${res.status})`)
  return (await res.json()) as T
}

const v = () => (stamp ? `?v=${encodeURIComponent(stamp)}` : '')

export function loadIndex(): Promise<ContentIndex> {
  if (!indexPromise) {
    /* Immer beim Server rückfragen: ein 304 ist billig, ein veralteter
       Aufgabenindex wäre teuer. */
    indexPromise = getJson<ContentIndex>(`${BASE}/index.json`, 'no-cache')
      .then((idx) => {
        stamp = idx.build || `${idx.version}-${idx.generatedAt}`
        return idx
      })
      .catch((e) => {
        indexPromise = null
        throw e
      })
  }
  return indexPromise
}

export function loadTopicExercises(topicId: string): Promise<Exercise[]> {
  let p = topicCache.get(topicId)
  if (!p) {
    p = getJson<Exercise[]>(`${BASE}/exercises/${topicId}.json${v()}`, 'force-cache').catch(() => [])
    topicCache.set(topicId, p)
  }
  return p
}

/** Lädt die vollständigen Aufgaben zu einer Liste von Kurzbeschreibungen. */
export async function loadExercises(metas: ExerciseMeta[]): Promise<Exercise[]> {
  const topics = [...new Set(metas.map((m) => m.topicId))]
  const loaded = await Promise.all(topics.map((t) => loadTopicExercises(t)))
  const byId = new Map<string, Exercise>()
  for (const list of loaded) for (const e of list) byId.set(e.id, e)
  return metas.map((m) => byId.get(m.id)).filter((e): e is Exercise => !!e)
}

export async function loadExerciseById(id: string, topicId: string): Promise<Exercise | null> {
  const list = await loadTopicExercises(topicId)
  return list.find((e) => e.id === id) ?? null
}

export function loadExam(id: string): Promise<Exam> {
  let p = examCache.get(id)
  if (!p) {
    p = getJson<Exam>(`${BASE}/exams/${id}.json${v()}`, 'force-cache')
    examCache.set(id, p)
  }
  return p
}

export function loadTheory(topicId: string): Promise<string | null> {
  let p = theoryCache.get(topicId)
  if (!p) {
    p = fetch(`${BASE}/theory/${topicId}.md${v()}`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
    theoryCache.set(topicId, p)
  }
  return p
}

/** Wärmt den Cache für die nächsten Themen vor, sobald der Browser Zeit hat. */
export function prefetchTopics(topicIds: string[]) {
  if (typeof window === 'undefined') return
  const go = () => topicIds.slice(0, 4).forEach((t) => void loadTopicExercises(t))
  if ('requestIdleCallback' in window) {
    ;(window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(go)
  } else {
    setTimeout(go, 800)
  }
}

export function groupByTopic<T extends { topicId: string }>(items: T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const i of items) (out[i.topicId] ??= []).push(i)
  return out
}
