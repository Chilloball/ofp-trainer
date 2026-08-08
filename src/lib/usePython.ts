'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BASE_PATH } from './paths'

export interface PyTestResult {
  name: string
  passed: boolean
  got?: string
  expected?: string
  error?: string
  hint?: string
}

export interface PyRunResult {
  stdout: string
  error: string | null
  errorType?: string
  traceback?: string
  /** Zeile im Nutzercode, in der der Fehler auftrat */
  line?: number
  tests: PyTestResult[]
}

type Status = 'idle' | 'loading' | 'ready' | 'running' | 'error'

/**
 * Lädt Pyodide in einem Web Worker und führt Nutzercode aus.
 * Der Worker wird beim ersten Bedarf gestartet und danach wiederverwendet;
 * nach einem Timeout wird er neu erzeugt (der Interpreter ist dann tot).
 */
export function usePython() {
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, (r: PyRunResult) => void>())
  const seq = useRef(0)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<string>('')

  const spawn = useCallback(() => {
    if (typeof window === 'undefined') return null
    const w = new Worker(`${BASE_PATH}/py-worker.js`)
    w.onmessage = (ev) => {
      const m = ev.data
      if (m.type === 'ready') {
        setStatus('ready')
        setProgress('')
      } else if (m.type === 'progress') {
        setProgress(m.text)
      } else if (m.type === 'fatal') {
        setStatus('error')
        setProgress(m.error)
        const open = [...pending.current.values()]
        pending.current.clear()
        for (const fn of open) {
          fn({ stdout: '', error: m.error, errorType: 'Fatal', tests: [] })
        }
      } else if (m.type === 'result') {
        const fn = pending.current.get(m.id)
        pending.current.delete(m.id)
        setStatus('ready')
        if (m.needsRestart) {
          /* Nach einer Zeitüberschreitung ist der Interpreter tot. Der Worker
             wird ersetzt — offene Aufträge müssen vorher beantwortet werden,
             sonst warten sie ewig. */
          w.terminate()
          workerRef.current = null
          const open = [...pending.current.values()]
          pending.current.clear()
          for (const other of open) {
            other({
              stdout: '',
              error: 'Die Python-Laufzeit wurde neu gestartet — bitte noch einmal ausführen.',
              errorType: 'Restarted',
              tests: [],
            })
          }
          setStatus('idle')
        }
        fn?.({
          stdout: m.stdout ?? '',
          error: m.error ?? null,
          errorType: m.errorType,
          traceback: m.traceback,
          line: m.line,
          tests: m.tests ?? [],
        })
      }
    }
    w.onerror = () => {
      setStatus('error')
      const open = [...pending.current.values()]
      pending.current.clear()
      for (const fn of open) {
        fn({
          stdout: '',
          error: 'Die Python-Laufzeit konnte nicht geladen werden. Besteht eine Internetverbindung?',
          errorType: 'WorkerError',
          tests: [],
        })
      }
    }
    workerRef.current = w
    return w
  }, [])

  const ensure = useCallback(() => {
    if (!workerRef.current) {
      setStatus('loading')
      const w = spawn()
      w?.postMessage({ type: 'init' })
    }
    return workerRef.current
  }, [spawn])

  /** Vorwärmen, sobald die Seite ruhig ist. */
  const preload = useCallback(() => {
    if (workerRef.current) return
    const cb = () => ensure()
    if ('requestIdleCallback' in window) {
      ;(window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(cb)
    } else {
      setTimeout(cb, 400)
    }
  }, [ensure])

  const run = useCallback(
    (code: string, tests: { name: string; call: string; expected: string }[] = [], stdin = ''): Promise<PyRunResult> => {
      const w = ensure()
      if (!w) return Promise.resolve({ stdout: '', error: 'Worker nicht verfügbar', tests: [] })
      setStatus('running')
      const id = ++seq.current
      return new Promise((resolve) => {
        pending.current.set(id, resolve)
        w.postMessage({ type: 'run', id, code, tests, stdin, timeoutMs: 9000 })
      })
    },
    [ensure],
  )

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return { run, status, progress, preload }
}
