'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { JavaDiagnostic, JavaResult, JavaTest, JavaTestResult } from './java'

/* ==================================================================== *
 *  Java im Browser
 *
 *  Der Compiler steckt vollständig in der App — kein Server, kein JDK.
 *  Er läuft in einem Worker; hängt ein Programm, wird der Worker
 *  beendet und neu gestartet.
 * ==================================================================== */

export interface JavaTestRun {
  results: JavaTestResult[]
  stdout: string
  error?: string
  diagnostics: JavaDiagnostic[]
}

type Status = 'idle' | 'running'

const HARD_LIMIT_MS = 9000

export function useJava() {
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, { resolve: (v: never) => void; timer: ReturnType<typeof setTimeout> }>())
  const seq = useRef(0)
  const [status, setStatus] = useState<Status>('idle')

  const spawn = useCallback(() => {
    if (typeof window === 'undefined') return null
    let w: Worker
    try {
      w = new Worker(new URL('../workers/java.worker.ts', import.meta.url))
    } catch {
      return null
    }
    w.onmessage = (ev: MessageEvent<{ id: number; type: string } & Record<string, unknown>>) => {
      const entry = pending.current.get(ev.data.id)
      if (!entry) return
      clearTimeout(entry.timer)
      pending.current.delete(ev.data.id)
      if (pending.current.size === 0) setStatus('idle')
      entry.resolve(ev.data as never)
    }
    workerRef.current = w
    return w
  }, [])

  const ensure = useCallback(() => workerRef.current ?? spawn(), [spawn])

  const kill = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    for (const [, e] of pending.current) clearTimeout(e.timer)
    pending.current.clear()
    setStatus('idle')
  }, [])

  const send = useCallback(
    <T>(payload: Record<string, unknown>, onTimeout: () => T): Promise<T> => {
      const w = ensure()
      const id = ++seq.current
      if (!w) {
        /* Fallback ohne Worker: direkt im Hauptthread ausführen. */
        return import('./java').then((mod) => {
          if (payload.type === 'run') {
            return { result: mod.runJava(payload.source as string, { stdin: payload.stdin as string, allowSnippet: payload.allowSnippet as boolean }) } as T
          }
          if (payload.type === 'test') {
            return {
              result: mod.runJavaTests(payload.source as string, payload.tests as JavaTest[], {
                stdin: payload.stdin as string,
                runMain: payload.runMain as boolean,
              }),
            } as T
          }
          return { diagnostics: mod.checkJava(payload.source as string) } as T
        })
      }
      setStatus('running')
      return new Promise<T>((resolve) => {
        const timer = setTimeout(() => {
          pending.current.delete(id)
          kill()
          resolve(onTimeout())
        }, HARD_LIMIT_MS)
        pending.current.set(id, { resolve: resolve as (v: never) => void, timer })
        w.postMessage({ ...payload, id })
      })
    },
    [ensure, kill],
  )

  const run = useCallback(
    (source: string, stdin = '', allowSnippet = true): Promise<JavaResult> =>
      send<{ result: JavaResult }>({ type: 'run', source, stdin, allowSnippet }, () => ({
        result: timeoutResult(),
      })).then((r) => r.result),
    [send],
  )

  const test = useCallback(
    (source: string, tests: JavaTest[], stdin = '', runMain = false): Promise<JavaTestRun> =>
      send<{ result: JavaTestRun }>({ type: 'test', source, tests, stdin, runMain }, () => ({
        result: {
          results: tests.map((t) => ({ name: t.name, passed: false, error: 'Zeitüberschreitung' })),
          stdout: '',
          error: 'Das Programm wurde nach 9 Sekunden abgebrochen — vermutlich eine Endlosschleife.',
          diagnostics: [],
        },
      })).then((r) => r.result),
    [send],
  )

  const check = useCallback(
    (source: string): Promise<JavaDiagnostic[]> =>
      send<{ diagnostics: JavaDiagnostic[] }>({ type: 'check', source }, () => ({ diagnostics: [] })).then(
        (r) => r.diagnostics,
      ),
    [send],
  )

  /** Startet den Worker im Hintergrund vor, damit der erste Lauf sofort reagiert. */
  const preload = useCallback(() => {
    if (!workerRef.current) ensure()
  }, [ensure])

  useEffect(() => () => kill(), [kill])

  return { run, test, check, preload, kill, status }
}

function timeoutResult(): JavaResult {
  return {
    ok: false,
    compiled: true,
    stdout: '',
    stderr: 'Das Programm wurde nach 9 Sekunden abgebrochen — vermutlich eine Endlosschleife.',
    diagnostics: [],
    exception: { type: 'Timeout', message: 'Abbruch nach 9 Sekunden' },
    durationMs: HARD_LIMIT_MS,
    timedOut: true,
    wrapped: false,
  }
}
