/// <reference lib="webworker" />
import { checkJava, runJava, runJavaTests, type JavaTest } from '@/lib/java'

/* Der Java-Compiler läuft in einem eigenen Thread: Endlosschleifen
   blockieren dadurch die Oberfläche nicht und lassen sich hart beenden. */

type Incoming =
  | { type: 'run'; id: number; source: string; stdin?: string; allowSnippet?: boolean; maxMillis?: number }
  | { type: 'test'; id: number; source: string; tests: JavaTest[]; stdin?: string; runMain?: boolean }
  | { type: 'check'; id: number; source: string }

self.onmessage = (ev: MessageEvent<Incoming>) => {
  const msg = ev.data
  try {
    if (msg.type === 'run') {
      const result = runJava(msg.source, {
        stdin: msg.stdin,
        allowSnippet: msg.allowSnippet,
        maxMillis: msg.maxMillis ?? 6000,
      })
      self.postMessage({ type: 'run', id: msg.id, result })
      return
    }
    if (msg.type === 'test') {
      const result = runJavaTests(msg.source, msg.tests, { stdin: msg.stdin, runMain: msg.runMain })
      self.postMessage({ type: 'test', id: msg.id, result })
      return
    }
    if (msg.type === 'check') {
      self.postMessage({ type: 'check', id: msg.id, diagnostics: checkJava(msg.source) })
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: msg.id, message: (e as Error)?.message ?? String(e) })
  }
}
