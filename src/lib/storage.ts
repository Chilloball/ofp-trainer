import type { UserProgress } from './types'

/* ==================================================================== *
 *  Lokale Speicherung des Lernstands
 *
 *  Der Fortschritt liegt ausschließlich im Browser des Lernenden
 *  (IndexedDB, mit localStorage als Rückfallebene). Dadurch braucht die
 *  App keinen Server und keine Anmeldung: Wer den Link öffnet, findet
 *  beim nächsten Mal genau dort weiter, wo er aufgehört hat.
 *
 *  Für Gerätewechsel gibt es Export/Import als Datei.
 * ==================================================================== */

const DB_NAME = 'ofp-trainer'
const STORE = 'state'
const KEY = 'progress'
const LS_KEY = 'ofp-trainer:progress'
export const SCHEMA_VERSION = 3

export function emptyProgress(name = ''): UserProgress {
  const now = Date.now()
  return {
    version: SCHEMA_VERSION,
    name,
    items: {},
    topics: {},
    exams: [],
    log: [],
    days: {},
    streak: { current: 0, best: 0, lastDay: null },
    scratch: { python: '', java: '' },
    settings: {
      dailyGoal: 15,
      theme: 'system',
      focus: 'balanced',
      showTimer: true,
      sessionLength: 10,
      onboarded: false,
    },
    createdAt: now,
    updatedAt: now,
  }
}

/* ----------------------------- IndexedDB ----------------------------- */

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, 1)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    // Safari im privaten Modus blockiert manchmal ohne Fehler
    setTimeout(() => resolve(req.result ?? null), 2500)
  })
  return dbPromise
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/* ------------------------------ Migration ------------------------------ */

function migrate(raw: unknown): UserProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<UserProgress> & Record<string, unknown>
  if (!p.items || typeof p.items !== 'object') return null

  const base = emptyProgress(typeof p.name === 'string' ? p.name : '')
  const merged: UserProgress = {
    ...base,
    ...p,
    version: SCHEMA_VERSION,
    items: p.items as UserProgress['items'],
    topics: (p.topics as UserProgress['topics']) ?? {},
    exams: Array.isArray(p.exams) ? p.exams : [],
    log: Array.isArray(p.log) ? p.log.slice(-800) : [],
    days: (p.days as UserProgress['days']) ?? {},
    streak: (p.streak as UserProgress['streak']) ?? base.streak,
    scratch: { ...base.scratch, ...((p.scratch as UserProgress['scratch']) ?? {}) },
    settings: { ...base.settings, ...((p.settings as UserProgress['settings']) ?? {}) },
    name: typeof p.name === 'string' ? p.name : '',
  }
  return merged
}

/* ------------------------------- Laden ------------------------------- */

export async function loadProgress(): Promise<UserProgress | null> {
  const fromIdb = await idbGet<unknown>(KEY)
  const migrated = migrate(fromIdb)
  if (migrated) return migrated

  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = migrate(JSON.parse(raw))
      if (p) {
        void idbSet(KEY, p) // einmalig in IndexedDB überführen
        return p
      }
    }
  } catch {
    /* localStorage nicht verfügbar */
  }
  return null
}

/* ------------------------------ Speichern ------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: UserProgress | null = null
let lastError: string | null = null

export function getStorageError() {
  return lastError
}

async function flush() {
  if (!pending) return
  const data = pending
  pending = null
  const ok = await idbSet(KEY, data)
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    lastError = null
  } catch (e) {
    if (!ok) {
      lastError =
        (e as Error)?.name === 'QuotaExceededError'
          ? 'Der Browserspeicher ist voll — der Lernstand konnte nicht gesichert werden.'
          : 'Der Lernstand konnte nicht gespeichert werden (privater Modus?).'
    }
  }
}

/** Speichert gebündelt, damit schnelles Klicken nicht dauernd schreibt. */
export function saveProgress(progress: UserProgress, immediate = false) {
  pending = { ...progress, updatedAt: Date.now() }
  if (saveTimer) clearTimeout(saveTimer)
  if (immediate) {
    void flush()
    return
  }
  saveTimer = setTimeout(() => void flush(), 400)
}

/** Beim Schließen des Tabs offene Schreibvorgänge abschließen. */
export function installUnloadFlush() {
  if (typeof window === 'undefined') return
  const handler = () => {
    if (!pending) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pending))
    } catch {
      /* ignorieren */
    }
  }
  window.addEventListener('pagehide', handler)
  window.addEventListener('beforeunload', handler)
}

/* --------------------------- Export / Import --------------------------- */

export function exportProgress(progress: UserProgress): Blob {
  const payload = {
    kind: 'ofp-trainer-backup',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    progress,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export function backupFilename(progress: UserProgress) {
  const day = new Date().toISOString().slice(0, 10)
  const who = progress.name ? '-' + progress.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''
  return `ofp-lernstand${who}-${day}.json`
}

export async function importProgress(file: File): Promise<UserProgress> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist keine gültige Sicherung (kein JSON).')
  }
  const holder = parsed as { kind?: string; progress?: unknown }
  const raw = holder?.kind === 'ofp-trainer-backup' ? holder.progress : parsed
  const p = migrate(raw)
  if (!p) throw new Error('Die Datei enthält keinen Lernstand des OFP-Trainers.')
  return p
}

/** Führt zwei Lernstände zusammen — der jeweils neuere Eintrag gewinnt. */
export function mergeProgress(a: UserProgress, b: UserProgress): UserProgress {
  const items = { ...a.items }
  for (const [id, st] of Object.entries(b.items)) {
    const cur = items[id]
    if (!cur || (st.lastReview ?? 0) > (cur.lastReview ?? 0)) items[id] = st
  }
  const days = { ...a.days }
  for (const [d, v] of Object.entries(b.days)) {
    const cur = days[d]
    days[d] = cur
      ? { done: Math.max(cur.done, v.done), minutes: Math.max(cur.minutes, v.minutes), correct: Math.max(cur.correct, v.correct) }
      : v
  }
  const examIds = new Set(a.exams.map((e) => e.id))
  return {
    ...a,
    name: a.name || b.name,
    items,
    days,
    exams: [...a.exams, ...b.exams.filter((e) => !examIds.has(e.id))].sort((x, y) => y.startedAt - x.startedAt),
    log: [...a.log, ...b.log].sort((x, y) => y.t - x.t).slice(0, 800),
    streak: a.streak.best >= b.streak.best ? a.streak : b.streak,
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Date.now(),
  }
}

export async function clearProgress() {
  const db = await openDb()
  if (db) {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
    } catch {
      /* ignorieren */
    }
  }
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignorieren */
  }
}
