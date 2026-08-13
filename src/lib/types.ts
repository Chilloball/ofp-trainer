/* ------------------------------------------------------------------ *
 * Zentrale Typen der OFP-Lernplattform
 * ------------------------------------------------------------------ */

export type Lang = 'python' | 'java'

export type ExerciseType =
  | 'code'
  | 'predict-output'
  | 'fill-gaps'
  | 'mc'
  | 'multi-mc'
  | 'short-answer'
  | 'find-errors'
  | 'uml'

export type Difficulty = 1 | 2 | 3 | 4 | 5

/** Wie sicher ist ein Thema klausurrelevant? */
export type Relevance = 'core' | 'likely' | 'edge' | 'low'

export interface SourceRef {
  file: string
  page?: number
  label?: string
  /** relativer Pfad im Kursordner, für Deep-Links */
  path?: string
}

export interface TestCase {
  name: string
  /** Python-Ausdruck, der ausgewertet wird */
  call: string
  /** Python-Literal, mit dem verglichen wird */
  expected: string
  /** optional: Test ist nur ein Beispiel und wird dem Nutzer vorab gezeigt */
  visible?: boolean
}

export interface Gap {
  id: number
  /** akzeptierte Antworten (normalisiert verglichen) */
  accept: string[]
  /** optional strengere/lockerere Regex-Alternative */
  regex?: string
  explanation?: string
}

export interface Choice {
  id: string
  text: string
  correct: boolean
  why?: string
}

export interface ErrorSpot {
  line?: number
  wrong: string
  fix: string
  why: string
}

export interface Exercise {
  id: string
  lang: Lang
  topicId: string
  type: ExerciseType
  difficulty: Difficulty
  points: number
  examStyle?: boolean
  title: string
  prompt: string
  code?: string
  starterCode?: string
  constraints?: string[]
  expectedOutput?: string
  /** Eingaben, die das Programm über die Konsole erwartet (für input()/Scanner) */
  stdin?: string
  tests?: TestCase[]
  forbidden?: string[]
  required?: string[]
  gaps?: Gap[]
  choices?: Choice[]
  errors?: ErrorSpot[]
  solution: string
  explanation: string
  hints?: string[]
  pitfalls?: string[]
  sources?: SourceRef[]
  tags?: string[]
  /** Mermaid-Diagramm für UML-Aufgaben */
  mermaid?: string
}

export interface Subtopic {
  id: string
  title: string
  /** Stichpunkte, die man können muss */
  points: string[]
  relevance: Relevance
}

export interface Topic {
  id: string
  lang: Lang
  order: number
  title: string
  /** Kurzbeschreibung für Karten */
  summary: string
  /** Woche/Vorlesung im Kurs */
  lecture: string
  relevance: Relevance
  /** erwarteter Punkteanteil in der Klausur (0..1, pro Sprache normiert) */
  examWeight: number
  /** typische Klausur-Aufgabenformate für dieses Thema */
  examFormats: string[]
  subtopics: Subtopic[]
  sources: SourceRef[]
  /** Themen, die man vorher können sollte */
  prereqs?: string[]
}

/* ---------------------- Fortschritt / Lernstand ---------------------- */

export type Grade = 0 | 1 | 2 | 3 // again | hard | good | easy

/**
 * Selbsteinschätzung VOR dem Prüfen (judgment of learning).
 *   0 = geraten · 1 = denke schon · 2 = sicher
 *
 * Zwei Gründe, warum das erhoben wird:
 *  • Kalibrierung — der Abstand zwischen Sicherheit und Trefferquote ist
 *    die aussagekräftigste Einzelzahl über den eigenen Lernstand.
 *  • Hypercorrection — ein Fehler, den man sich SICHER war, wird nach
 *    einer Rückmeldung besonders zuverlässig korrigiert. Dafür muss man
 *    ihn aber erkennen können.
 */
export type Confidence = 0 | 1 | 2

export interface ItemState {
  exerciseId: string
  topicId: string
  /** FSRS-ähnlich */
  stability: number
  difficulty: number
  reps: number
  lapses: number
  lastReview: number | null
  due: number
  /** letzte Ergebnisse, neuestes zuerst (max 10) */
  history: { t: number; score: number; ms: number; grade: Grade; confidence?: Confidence }[]
  /** 0..1 */
  mastery: number
  /** wurde als "kann ich" markiert */
  starred?: boolean
  flagged?: boolean
}

export interface TopicState {
  topicId: string
  mastery: number
  seen: number
  correct: number
  attempts: number
  lastPracticed: number | null
  /** gleitendes Mittel der Antwortzeit relativ zur Zielzeit */
  speed: number
}

export interface ExamAttempt {
  id: string
  examId: string
  startedAt: number
  finishedAt: number | null
  durationMs: number
  answers: Record<string, unknown>
  scores: Record<string, number>
  maxScores: Record<string, number>
  total: number
  max: number
  grade?: string
}

export interface SessionLog {
  t: number
  exerciseId: string
  topicId: string
  score: number
  ms: number
  usedHints: number
  revealed: boolean
  confidence?: Confidence
}

export interface Settings {
  /** Aufgaben pro Tag */
  dailyGoal: number
  /**
   * Tage vor der Klausur, an denen der Stoff fertig sein soll.
   *
   * Der Plan zielt bewusst NICHT auf den Klausurtag. Wer auf Kante
   * plant, hat bei einem kranken Wochenende keinen Ausweg mehr — und
   * die letzten Tage vor einer Prüfung sind ohnehin die schlechtesten,
   * um Neues anzufangen.
   */
  bufferDays: number
  theme: 'dark' | 'light' | 'system'
  focus: 'balanced' | 'python' | 'java' | 'weakest'
  showTimer: boolean
  /** Aufgabenanzahl je Lernrunde */
  sessionLength: number
  /** Begrüßung wurde durchlaufen */
  onboarded: boolean
}

export interface UserProgress {
  /** Schema-Version, für spätere Migrationen */
  version: number
  name: string
  items: Record<string, ItemState>
  topics: Record<string, TopicState>
  exams: ExamAttempt[]
  log: SessionLog[]
  /** Tagesstatistik: YYYY-MM-DD -> {done, minutes, correct} */
  days: Record<string, { done: number; minutes: number; correct: number }>
  streak: { current: number; best: number; lastDay: string | null }
  /** zuletzt im Compiler bearbeiteter Code, je Sprache */
  scratch: { python: string; java: string }
  settings: Settings
  createdAt: number
  updatedAt: number
}

/* ------------------------- Content-Index (statisch) ------------------------- */

/** Leichtgewichtige Beschreibung einer Aufgabe – reicht für die Auswahl-Logik. */
export interface ExerciseMeta {
  id: string
  topicId: string
  lang: Lang
  type: ExerciseType
  difficulty: Difficulty
  points: number
  title: string
  examStyle?: boolean
}

export interface ExamMeta {
  id: string
  lang: Lang | 'both'
  title: string
  subtitle?: string
  minutes: number
  totalPoints: number
  bonusPoints?: number
  origin: 'original' | 'generated'
  taskCount: number
  note?: string
}

export interface ContentIndex {
  version: number
  /** Inhalts-Hash; hängt an den URLs der Detaildateien */
  build: string
  generatedAt: string
  total: number
  byLang: { python: number; java: number }
  examStyle: number
  items: ExerciseMeta[]
  exams: ExamMeta[]
  theory: string[]
}

/* ---------------------------- Klausuren ---------------------------- */

/** Bauplan: zieht Aufgaben zur Laufzeit aus der Aufgabenbank. */
export interface TaskBlueprint {
  topicIds: string[]
  type?: ExerciseType | ExerciseType[]
  count: number
  minDifficulty?: number
  maxDifficulty?: number
  examStyleOnly?: boolean
}

export interface ExamTask {
  id: string
  label: string
  title: string
  points: number
  /** Aufgaben-IDs aus der Bank ODER inline definierte Aufgabe ODER Bauplan */
  exerciseIds?: string[]
  inline?: Exercise[]
  blueprint?: TaskBlueprint
  instructions?: string
}

export interface Exam {
  id: string
  lang: Lang | 'both'
  title: string
  subtitle?: string
  minutes: number
  totalPoints: number
  bonusPoints?: number
  origin: 'original' | 'generated'
  tasks: ExamTask[]
  note?: string
}
