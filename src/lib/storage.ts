import type { UserProgress } from './types'

/* ==================================================================== *
 *  Lokale Speicherung des Lernstands
 *
 *  Der Lernstand ist das Einzige an dieser App, was sich nicht neu
 *  erzeugen lässt. Wochen an Arbeit stecken darin. Entsprechend wird
 *  hier nicht einfach „gespeichert", sondern gegen die vier realen
 *  Verlustwege abgesichert:
 *
 *  1. AUTOMATISCHES LÖSCHEN DURCH DEN BROWSER — der gefährlichste.
 *     Safari räumt IndexedDB *und* localStorage einer Seite weg, die
 *     sieben Tage nicht besucht wurde. Wer über die Semesterferien
 *     pausiert, käme zurück und fände nichts vor.
 *     → `navigator.storage.persist()` markiert den Speicher als
 *       dauerhaft und nimmt die Seite aus dieser Aufräumaktion heraus.
 *
 *  2. OFFENER SCHREIBVORGANG BEIM SCHLIESSEN.
 *     → Antworten werden sofort geschrieben, nicht gebündelt. Zusätzlich
 *       wird bei `visibilitychange`, `pagehide` und `beforeunload`
 *       synchron nach localStorage durchgeschrieben.
 *
 *  3. ZWEI OFFENE TABS überschreiben sich gegenseitig.
 *     → Jeder Schreibvorgang meldet sich über einen BroadcastChannel;
 *       ältere Tabs laden nach, statt ihren veralteten Stand zu sichern.
 *
 *  4. KAPUTTER DATENSATZ (Programmfehler, abgebrochener Schreibvorgang).
 *     → Ein Ring aus Schnappschüssen. Ist der Hauptdatensatz unbrauchbar,
 *       wird still auf den jüngsten heilen zurückgefallen.
 *
 *  Was das NICHT abfängt: gelöschte Browserdaten und Gerätewechsel.
 *  Dagegen hilft nur eine Datei — siehe Export/Import.
 * ==================================================================== */

const DB_NAME = 'ofp-trainer'
const STORE = 'state'
const KEY = 'progress'
const SNAP_PREFIX = 'snapshot:'
const SNAP_COUNT = 5
/** Höchstens alle zehn Minuten ein neuer Schnappschuss. */
const SNAP_INTERVAL = 10 * 60 * 1000

const LS_KEY = 'ofp-trainer:progress'
const LS_PREV = 'ofp-trainer:progress:vorher'
const CHANNEL = 'ofp-trainer:sync'

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
      bufferDays: 4,
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
    /* Safari im privaten Modus blockiert gelegentlich ohne Fehlermeldung. */
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
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
  } catch {
    /* ignorieren */
  }
}

/* -------------------------- Dauerhafter Speicher -------------------------- */

export interface StorageHealth {
  /** Der Browser hat zugesagt, den Speicher nicht selbsttätig zu löschen. */
  persistent: boolean
  /** Wurde überhaupt schon gefragt? */
  asked: boolean
  /** belegte und verfügbare Bytes, falls der Browser sie herausgibt */
  usage: number | null
  quota: number | null
  /** Wo der Stand tatsächlich liegt */
  mode: 'idb' | 'localStorage' | 'keiner'
  /** Zeitpunkt der letzten bestätigten Sicherung in eine Datei */
  lastBackup: number | null
}

const LS_ASKED = 'ofp-trainer:persist-gefragt'
const LS_BACKUP = 'ofp-trainer:letzte-sicherung'

/**
 * Bittet den Browser, den Speicher dieser Seite dauerhaft zu behalten.
 *
 * Ohne das räumt Safari nach sieben Tagen ohne Besuch alles weg — der
 * mit Abstand häufigste Weg, auf dem Lernstände verschwinden. Chrome
 * gewährt es ab genügend Nutzung automatisch, Firefox fragt nach.
 * Der Aufruf ist harmlos, wenn der Browser es nicht kennt.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    localStorage.setItem(LS_ASKED, '1')
  } catch {
    /* ignorieren */
  }
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageHealth(): Promise<StorageHealth> {
  let persistent = false
  let usage: number | null = null
  let quota: number | null = null
  try {
    persistent = (await navigator.storage?.persisted?.()) ?? false
    const est = await navigator.storage?.estimate?.()
    usage = est?.usage ?? null
    quota = est?.quota ?? null
  } catch {
    /* Browser gibt nichts heraus */
  }

  let mode: StorageHealth['mode'] = 'keiner'
  if (await openDb()) mode = 'idb'
  else {
    try {
      localStorage.setItem('ofp-trainer:probe', '1')
      localStorage.removeItem('ofp-trainer:probe')
      mode = 'localStorage'
    } catch {
      mode = 'keiner'
    }
  }

  let asked = false
  let lastBackup: number | null = null
  try {
    asked = localStorage.getItem(LS_ASKED) === '1'
    const b = localStorage.getItem(LS_BACKUP)
    lastBackup = b ? Number(b) : null
  } catch {
    /* ignorieren */
  }

  return { persistent, asked, usage, quota, mode, lastBackup }
}

export function markBackupTaken() {
  try {
    localStorage.setItem(LS_BACKUP, String(Date.now()))
  } catch {
    /* ignorieren */
  }
}

/* ------------------------------ Migration ------------------------------ */

/** Grobprüfung: Sieht das überhaupt nach einem Lernstand aus? */
function isPlausible(p: unknown): p is UserProgress {
  if (!p || typeof p !== 'object') return false
  const x = p as Partial<UserProgress>
  return !!x.items && typeof x.items === 'object' && typeof x.createdAt === 'number'
}

export function migrateProgress(raw: unknown): UserProgress | null {
  return migrate(raw)
}

function migrate(raw: unknown): UserProgress | null {
  if (!isPlausible(raw)) return null
  const p = raw as Partial<UserProgress> & Record<string, unknown>

  const base = emptyProgress(typeof p.name === 'string' ? p.name : '')
  return {
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
}

/* ------------------------------- Laden ------------------------------- */

/** Woher der Stand beim letzten Laden kam — für die ehrliche Anzeige. */
let loadedFrom: 'idb' | 'localStorage' | 'schnappschuss' | 'neu' = 'neu'
export const getLoadSource = () => loadedFrom

function readLocal(key: string): UserProgress | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? migrate(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/**
 * Lädt den Lernstand aus der jeweils besten verfügbaren Quelle.
 *
 * Reihenfolge: IndexedDB → localStorage → Schnappschüsse → Vorgängerstand.
 * Gibt es mehrere, gewinnt der zuletzt geänderte — nicht die erstbeste
 * Quelle. Sonst könnte ein alter localStorage-Rest einen neueren Stand
 * aus IndexedDB verdrängen.
 */
export async function loadProgress(): Promise<UserProgress | null> {
  const candidates: { p: UserProgress; from: typeof loadedFrom }[] = []

  const fromIdb = migrate(await idbGet<unknown>(KEY))
  if (fromIdb) candidates.push({ p: fromIdb, from: 'idb' })

  const fromLs = readLocal(LS_KEY)
  if (fromLs) candidates.push({ p: fromLs, from: 'localStorage' })

  if (candidates.length === 0) {
    /* Nichts Reguläres da — die Rettungswege durchgehen. */
    for (let i = 0; i < SNAP_COUNT; i++) {
      const snap = migrate(await idbGet<unknown>(SNAP_PREFIX + i))
      if (snap) candidates.push({ p: snap, from: 'schnappschuss' })
    }
    const prev = readLocal(LS_PREV)
    if (prev) candidates.push({ p: prev, from: 'schnappschuss' })
  }

  if (candidates.length === 0) {
    loadedFrom = 'neu'
    return null
  }

  candidates.sort((a, b) => (b.p.updatedAt ?? 0) - (a.p.updatedAt ?? 0))
  const best = candidates[0]
  loadedFrom = best.from

  /* Was aus einer Ausweichquelle kam, sofort wieder regulär ablegen. */
  if (best.from !== 'idb') void idbSet(KEY, best.p)
  return best.p
}

/* ------------------------------ Speichern ------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pending: UserProgress | null = null
let lastError: string | null = null
let lastSnapshot = 0
let snapshotSlot = 0
/** Zeitpunkt des zuletzt bestätigten Schreibvorgangs. */
let lastWrite = 0

export function getStorageError() {
  return lastError
}
export const getLastWrite = () => lastWrite

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  try {
    channel = new BroadcastChannel(CHANNEL)
  } catch {
    channel = null
  }
  return channel
}

/** Schreibt synchron nach localStorage — das Einzige, was beim Schließen sicher durchläuft. */
function writeLocal(data: UserProgress): boolean {
  try {
    const serialized = JSON.stringify(data)
    /* Den bisherigen Stand als zweite Chance behalten, BEVOR überschrieben
       wird. Kostet doppelten Platz, rettet aber einen halb geschriebenen
       oder fehlerhaft erzeugten Datensatz. */
    const before = localStorage.getItem(LS_KEY)
    if (before && before !== serialized) {
      try {
        localStorage.setItem(LS_PREV, before)
      } catch {
        /* Platz reicht nicht für die Zweitkopie — dann eben ohne. */
      }
    }
    localStorage.setItem(LS_KEY, serialized)
    return true
  } catch {
    return false
  }
}

async function flush() {
  if (!pending) return
  const data = pending
  pending = null

  const okIdb = await idbSet(KEY, data)
  const okLs = writeLocal(data)

  if (okIdb || okLs) {
    lastWrite = Date.now()
    lastError = null
    getChannel()?.postMessage({ type: 'gespeichert', updatedAt: data.updatedAt })

    /* Schnappschuss in den Ring — nur gelegentlich, er ist die
       Rückfallebene für den Fall, dass der Hauptdatensatz kaputtgeht. */
    if (okIdb && Date.now() - lastSnapshot > SNAP_INTERVAL) {
      lastSnapshot = Date.now()
      void idbSet(SNAP_PREFIX + snapshotSlot, data)
      snapshotSlot = (snapshotSlot + 1) % SNAP_COUNT
    }
  } else {
    lastError =
      'Der Lernstand lässt sich in diesem Browser nicht speichern (privates Fenster oder blockierte Website-Daten). ' +
      'Lade dir am Ende der Sitzung unbedingt eine Sicherung herunter.'
  }
}

/**
 * Speichert den Lernstand.
 *
 * `immediate` ist für alles gedacht, dessen Verlust wehtäte — vor allem
 * beantwortete Aufgaben. Nur reine Tipp- und Scrollzustände dürfen
 * gebündelt werden.
 */
export function saveProgress(progress: UserProgress, immediate = false) {
  pending = { ...progress, updatedAt: Date.now() }
  if (saveTimer) clearTimeout(saveTimer)
  if (immediate) {
    /* Erst synchron nach localStorage — falls der Tab in der nächsten
       Millisekunde geschlossen wird, ist die Antwort dann schon sicher. */
    writeLocal(pending)
    void flush()
    return
  }
  saveTimer = setTimeout(() => void flush(), 300)
}

/**
 * Hängt sich an alle Wege, auf denen eine Seite verschwinden kann.
 *
 * `beforeunload` allein reicht nicht: Auf Mobilgeräten wird ein Tab oft
 * ohne dieses Ereignis beendet. `visibilitychange` auf `hidden` ist der
 * einzige Zeitpunkt, der dort verlässlich kommt.
 */
export function installUnloadFlush(onExternalChange?: () => void) {
  if (typeof window === 'undefined') return

  const writeNow = () => {
    if (pending) writeLocal(pending)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writeNow()
  })
  window.addEventListener('pagehide', writeNow)
  window.addEventListener('beforeunload', writeNow)
  /* Sicherheitsnetz: alle 20 Sekunden durchschreiben, falls ein
     Ereignis einmal ausbleibt. */
  setInterval(() => {
    if (pending) void flush()
  }, 20_000)

  /* Zweiter Tab hat geschrieben → dieser Tab lädt nach, statt seinen
     veralteten Stand darüberzulegen. */
  const ch = getChannel()
  if (ch && onExternalChange) {
    ch.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'gespeichert' && e.data.updatedAt > lastWrite) onExternalChange()
    })
  }
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
  const d = new Date()
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
      ? {
          done: Math.max(cur.done, v.done),
          minutes: Math.max(cur.minutes, v.minutes),
          correct: Math.max(cur.correct, v.correct),
        }
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
  pending = null
  if (saveTimer) clearTimeout(saveTimer)
  await idbDelete(KEY)
  for (let i = 0; i < SNAP_COUNT; i++) await idbDelete(SNAP_PREFIX + i)
  try {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_PREV)
  } catch {
    /* ignorieren */
  }
}
