/* eslint-disable */
/* ==================================================================== *
 *  Python-Laufzeit (Pyodide = echtes CPython als WebAssembly)
 *
 *  Läuft in einem eigenen Thread. Nachrichten:
 *    → { type: 'init' }
 *    → { type: 'run', id, code, tests, stdin, timeoutMs }
 *    ← { type: 'ready' | 'progress' | 'result' | 'fatal' }
 * ==================================================================== */

const PYODIDE_VERSION = 'v0.26.4'
const CDNS = [
  `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`,
  `https://fastly.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`,
]

let pyodide = null
let booting = null

async function boot() {
  if (pyodide) return pyodide
  if (booting) return booting
  booting = (async () => {
    let lastErr = null
    for (const base of CDNS) {
      try {
        self.postMessage({ type: 'progress', text: 'Python-Laufzeit wird geladen …' })
        importScripts(base + 'pyodide.js')
        pyodide = await loadPyodide({ indexURL: base })
        self.postMessage({ type: 'ready' })
        return pyodide
      } catch (e) {
        lastErr = e
      }
    }
    booting = null
    throw lastErr || new Error('Die Python-Laufzeit konnte nicht geladen werden. Besteht eine Internetverbindung?')
  })()
  return booting
}

/* Das Harness liegt als konstanter Quelltext vor; die Nutzerdaten kommen
   über eine Variable im Python-Namensraum. Dadurch gibt es keinerlei
   Escaping-Probleme mit Anführungszeichen oder Backslashes im Code. */
const HARNESS = `
import json, io, sys, builtins, traceback

__p = json.loads(__ofp_payload)
__result = {"stdout": "", "error": None, "tests": []}
__out = io.StringIO()

class _Stdin:
    def __init__(self, data):
        self.lines = data.split("\\n") if data else []
        self.i = 0
    def __call__(self, prompt=""):
        print(prompt, end="")
        if self.i < len(self.lines):
            v = self.lines[self.i]
            self.i += 1
            print(v)
            return v
        raise EOFError("Es wurden mehr Eingaben angefordert als vorhanden sind. Trage sie links unter «Konsoleneingabe» ein.")

_feed = _Stdin(__p["stdin"])
__ns = {"__name__": "__main__"}

_real_out, _real_err = sys.stdout, sys.stderr
_real_input = builtins.input
sys.stdout = __out
sys.stderr = __out
builtins.input = _feed
try:
    exec(compile(__p["code"], "<deine Lösung>", "exec"), __ns)
except SystemExit:
    pass
except BaseException as e:
    __result["error"] = "".join(traceback.format_exception_only(type(e), e)).strip()
    __result["errorType"] = type(e).__name__
    __tb = traceback.extract_tb(sys.exc_info()[2])
    __own = [f for f in __tb if f.filename == "<deine Lösung>"]
    if __own:
        __result["line"] = __own[-1].lineno
    __result["traceback"] = "".join(
        traceback.format_list(__own) + traceback.format_exception_only(type(e), e)
    ).strip()
finally:
    sys.stdout, sys.stderr = _real_out, _real_err
    builtins.input = _real_input

__result["stdout"] = __out.getvalue()

if not __result["error"]:
    for __t in __p["tests"]:
        __entry = {"name": __t.get("name", ""), "passed": False}
        __buf = io.StringIO()
        _o = sys.stdout
        sys.stdout = __buf
        try:
            __got = eval(__t["call"], __ns)
            __exp = eval(__t["expected"], __ns)
            __entry["passed"] = bool(__got == __exp)
            __entry["got"] = repr(__got)
            __entry["expected"] = repr(__exp)
            if str(type(__got)) in ("<class 'map'>", "<class 'filter'>", "<class 'zip'>"):
                __entry["hint"] = "Das Ergebnis ist ein Iterator — fehlt ein list(...) darum herum?"
        except BaseException as e:
            __entry["error"] = "".join(traceback.format_exception_only(type(e), e)).strip()
        finally:
            sys.stdout = _o
        __result["tests"].append(__entry)

json.dumps(__result)
`

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

self.onmessage = async (ev) => {
  const msg = ev.data

  if (msg.type === 'init') {
    try {
      await boot()
    } catch (e) {
      self.postMessage({ type: 'fatal', error: String(e && e.message ? e.message : e) })
    }
    return
  }

  const { id, code, tests, stdin, timeoutMs } = msg
  try {
    const py = await boot()
    py.globals.set('__ofp_payload', JSON.stringify({ code: code ?? '', tests: tests ?? [], stdin: stdin ?? '' }))
    const raw = await withTimeout(py.runPythonAsync(HARNESS), timeoutMs || 9000)
    self.postMessage({ type: 'result', id, ...JSON.parse(raw) })
  } catch (e) {
    if (String(e && e.message) === 'TIMEOUT') {
      self.postMessage({
        type: 'result',
        id,
        stdout: '',
        error:
          'Zeitüberschreitung: Das Programm lief zu lange und wurde abgebrochen. Typische Ursache ist eine Schleife, deren Bedingung nie falsch wird, oder eine Rekursion ohne Abbruchbedingung.',
        errorType: 'Timeout',
        tests: [],
        needsRestart: true,
      })
    } else {
      self.postMessage({
        type: 'result',
        id,
        stdout: '',
        error: String(e && e.message ? e.message : e),
        errorType: 'InternalError',
        tests: [],
      })
    }
  }
}
