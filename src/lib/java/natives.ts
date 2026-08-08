import {
  JavaRuntimeError, NULL, TRUE, FALSE, asBigInt, asBoolean, asNumber, describeKind,
  jbool, jchar, jdouble, jfloat, jint, jlong, jstr, jstrNew, javaDoubleToString, javaFloatToString,
  refEquals, unbox, type Val,
} from './values'
import type { TypeRef } from './ast'

/* ==================================================================== *
 *  Java-Standardbibliothek (der in der Vorlesung genutzte Ausschnitt)
 * ==================================================================== */

export interface NativeCtx {
  print(text: string, toErr?: boolean): void
  /** String.valueOf – ruft bei Objekten deren toString() auf */
  str(v: Val): string
  /** liest die nächste Zeile aus der simulierten Konsole */
  readLine(): string | null
  /** liest das nächste durch Leerzeichen getrennte Token */
  readToken(): string | null
  hasMoreInput(kind: 'line' | 'token' | 'int'): boolean
  /** ruft ein Lambda oder eine funktionale Schnittstelle auf */
  callFunctional(fn: Val, args: Val[]): Val
  /** Objektvergleich mit benutzerdefiniertem equals() */
  valueEquals(a: Val, b: Val): boolean
  /** compareTo für Sortierungen */
  compareValues(a: Val, b: Val): number
  exit(code: number): never
}

/* ------------------------------ Hilfen ------------------------------ */

export function hashOf(v: Val, ctx: NativeCtx): number {
  switch (v.k) {
    case 'null': return 0
    case 'int': case 'short': case 'byte': case 'char': return v.v | 0
    case 'boolean': return v.v ? 1231 : 1237
    case 'long': return Number(BigInt.asIntN(32, v.v ^ (v.v >> 32n))) | 0
    case 'double': case 'float': {
      const buf = new DataView(new ArrayBuffer(8))
      buf.setFloat64(0, v.v)
      const hi = buf.getInt32(0)
      const lo = buf.getInt32(4)
      return (hi ^ lo) | 0
    }
    case 'str': return stringHash(v.v)
    case 'nat': return hashOf(unbox(v), ctx)
    default: return stringHash(ctx.str(v))
  }
}

export function stringHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

/** Reihenfolge wie in Javas HashMap: Bucket-Index, innerhalb dessen Einfügereihenfolge. */
function hashOrder<T>(entries: { key: Val; data: T }[], ctx: NativeCtx): { key: Val; data: T }[] {
  let cap = 16
  while (entries.length > cap * 0.75) cap *= 2
  return entries
    .map((e, i) => {
      const h = hashOf(e.key, ctx)
      const spread = (h ^ (h >>> 16)) | 0
      return { e, i, bucket: spread & (cap - 1) }
    })
    .sort((a, b) => a.bucket - b.bucket || a.i - b.i)
    .map((x) => x.e)
}

export interface JList { items: Val[]; sorted?: boolean }
export interface JMap {
  entries: Map<string, { key: Val; value: Val; seq: number }>
  seq: number
  sorted: boolean
}
export interface JSet {
  entries: Map<string, { key: Val; seq: number }>
  seq: number
  sorted: boolean
}

const T = (tag: string, v: unknown): Val & { k: 'nat' } => ({ k: 'nat', tag, v })

export function newList(items: Val[] = []): Val & { k: 'nat' } {
  return T('ArrayList', { items } as JList)
}
export function newMap(sorted = false): Val & { k: 'nat' } {
  return T('HashMap', { entries: new Map(), seq: 0, sorted } as JMap)
}
export function newSet(sorted = false): Val & { k: 'nat' } {
  return T('HashSet', { entries: new Map(), seq: 0, sorted } as JSet)
}

function keyOf(v: Val, ctx: NativeCtx): string {
  const u = unbox(v)
  switch (u.k) {
    case 'null': return 'null'
    case 'str': return 's:' + u.v
    case 'boolean': return 'b:' + u.v
    case 'long': return 'n:' + u.v.toString()
    case 'char': return 'c:' + u.v
    case 'int': case 'short': case 'byte': return 'n:' + u.v
    case 'double': case 'float': return 'n:' + u.v
    default: return 'o:' + ctx.str(u) + '#' + hashOf(u, ctx)
  }
}

export function mapEntriesOrdered(m: JMap, ctx: NativeCtx) {
  const list = [...m.entries.values()]
  if (m.sorted) return [...list].sort((a, b) => ctx.compareValues(a.key, b.key))
  return hashOrder(list.map((e) => ({ key: e.key, data: e })), ctx).map((x) => x.data)
}
export function setEntriesOrdered(s: JSet, ctx: NativeCtx) {
  const list = [...s.entries.values()]
  if (s.sorted) return [...list].sort((a, b) => ctx.compareValues(a.key, b.key))
  return hashOrder(list.map((e) => ({ key: e.key, data: e })), ctx).map((x) => x.data)
}

/** Elemente für die erweiterte for-Schleife. */
export function iterableToArray(v: Val, ctx: NativeCtx): Val[] {
  if (v.k === 'arr') return v.v
  if (v.k === 'nat') {
    switch (v.tag) {
      case 'ArrayList': return [...(v.v as JList).items]
      case 'HashSet': return setEntriesOrdered(v.v as JSet, ctx).map((e) => e.key)
      case 'KeySet': return (v.v as Val[]).slice()
      case 'Values': return (v.v as Val[]).slice()
      case 'EntrySet': return (v.v as Val[]).slice()
      case 'HashMap':
        throw new JavaRuntimeError(
          'IncompatibleTypes',
          'Über eine Map kann man nicht direkt iterieren. Nutze map.keySet(), map.values() oder map.entrySet().',
        )
    }
  }
  if (v.k === 'null') throw new JavaRuntimeError('NullPointerException', 'Die Sammlung ist null.')
  throw new JavaRuntimeError('IncompatibleTypes', `Über ${describeKind(v)} kann nicht mit for-each iteriert werden.`)
}

/* --------------------------- printf / format --------------------------- */

export function javaFormat(fmt: string, args: Val[], ctx: NativeCtx): string {
  let out = ''
  let ai = 0
  let i = 0
  while (i < fmt.length) {
    const c = fmt[i]
    if (c !== '%') {
      out += c
      i++
      continue
    }
    const m = /^%([-+ 0,#]*)(\d+)?(?:\.(\d+))?([sdfnbxXoeEcE%])/.exec(fmt.slice(i))
    if (!m) {
      out += c
      i++
      continue
    }
    const [all, flags, widthS, precS, conv] = m
    i += all.length
    if (conv === '%') {
      out += '%'
      continue
    }
    if (conv === 'n') {
      out += '\n'
      continue
    }
    const arg = args[ai++]
    if (arg === undefined) {
      throw new JavaRuntimeError('MissingFormatArgumentException', `Für «%${conv}» wurde kein Wert übergeben.`)
    }
    const width = widthS ? parseInt(widthS, 10) : 0
    const prec = precS ? parseInt(precS, 10) : undefined
    let s: string

    switch (conv) {
      case 'd': {
        const u = unbox(arg)
        let n: string
        if (u.k === 'long') n = u.v.toString()
        else n = String(Math.trunc(asNumber(u)))
        if (flags.includes(',')) n = groupDigits(n)
        if (flags.includes('+') && !n.startsWith('-')) n = '+' + n
        s = n
        break
      }
      case 'f': {
        const p = prec ?? 6
        const n = asNumber(unbox(arg))
        s = fixed(n, p)
        if (flags.includes(',')) {
          const [ip, fp] = s.split('.')
          s = groupDigits(ip) + (fp ? '.' + fp : '')
        }
        if (flags.includes('+') && !s.startsWith('-')) s = '+' + s
        break
      }
      case 'e': case 'E': {
        const p = prec ?? 6
        const n = asNumber(unbox(arg))
        s = n.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2')
        if (conv === 'E') s = s.toUpperCase()
        break
      }
      case 'b': {
        const u = unbox(arg)
        s = u.k === 'null' ? 'false' : u.k === 'boolean' ? String(u.v) : 'true'
        break
      }
      case 'c': {
        const u = unbox(arg)
        s = u.k === 'str' ? u.v : String.fromCharCode(asNumber(u))
        break
      }
      case 'x': case 'X': case 'o': {
        const u = unbox(arg)
        const big = u.k === 'long' ? BigInt.asUintN(64, u.v) : BigInt(asNumber(u) >>> 0)
        s = big.toString(conv === 'o' ? 8 : 16)
        if (conv === 'X') s = s.toUpperCase()
        break
      }
      default: {
        s = ctx.str(arg)
        if (prec !== undefined) s = s.slice(0, prec)
        break
      }
    }

    if (width > s.length) {
      if (flags.includes('-')) s = s.padEnd(width, ' ')
      else if (flags.includes('0') && 'dfeExXo'.includes(conv)) {
        const neg = s.startsWith('-') || s.startsWith('+')
        s = neg ? s[0] + s.slice(1).padStart(width - 1, '0') : s.padStart(width, '0')
      } else s = s.padStart(width, ' ')
    }
    out += s
  }
  return out
}

function groupDigits(n: string): string {
  const neg = n.startsWith('-')
  const digits = neg ? n.slice(1) : n
  const [ip, fp] = digits.split('.')
  const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (neg ? '-' : '') + grouped + (fp ? ',' + fp : '')
}

/** Java rundet in `%f` und `Math.round` kaufmännisch (HALF_UP). */
function fixed(n: number, p: number): string {
  if (!Number.isFinite(n)) return String(n)
  const neg = n < 0
  const a = Math.abs(n)
  const factor = Math.pow(10, p)
  let r = Math.round(a * factor + Number.EPSILON * a * factor) / factor
  if (Math.abs(a * factor - Math.trunc(a * factor) - 0.5) < 1e-9) r = (Math.trunc(a * factor) + 1) / factor
  const s = r.toFixed(p)
  return neg && Number(s) !== 0 ? '-' + s : neg ? '-' + s : s
}

/* --------------------------- String-Methoden --------------------------- */

export function stringMethod(recv: Val & { k: 'str' }, name: string, args: Val[], ctx: NativeCtx): Val {
  const s = recv.v
  const a = (i: number) => args[i]
  const num = (i: number) => Math.trunc(asNumber(unbox(args[i])))
  const text = (i: number) => ctx.str(args[i])
  /** Java gibt bei unveränderten Ergebnissen dasselbe Objekt zurück. */
  const same = (out: string) => (out === s ? recv : jstrNew(out))

  const checkIndex = (idx: number, max: number, what = 'index') => {
    if (idx < 0 || idx >= max) {
      throw new JavaRuntimeError('StringIndexOutOfBoundsException', `${what} ${idx}, length ${max}`)
    }
  }

  switch (name) {
    case 'length': return jint(s.length)
    case 'isEmpty': return jbool(s.length === 0)
    case 'isBlank': return jbool(s.trim().length === 0)
    case 'charAt': {
      const i = num(0)
      checkIndex(i, s.length)
      return jchar(s.charCodeAt(i))
    }
    case 'indexOf': {
      const needle = a(0).k === 'char' ? String.fromCharCode(asNumber(a(0))) : text(0)
      return jint(s.indexOf(needle, args.length > 1 ? num(1) : 0))
    }
    case 'lastIndexOf': {
      const needle = a(0).k === 'char' ? String.fromCharCode(asNumber(a(0))) : text(0)
      return jint(args.length > 1 ? s.lastIndexOf(needle, num(1)) : s.lastIndexOf(needle))
    }
    case 'substring': {
      const from = num(0)
      const to = args.length > 1 ? num(1) : s.length
      if (from < 0 || to > s.length || from > to) {
        throw new JavaRuntimeError('StringIndexOutOfBoundsException', `begin ${from}, end ${to}, length ${s.length}`)
      }
      return from === 0 && to === s.length ? recv : jstrNew(s.slice(from, to))
    }
    case 'equals': {
      const o = a(0)
      return jbool(o.k === 'str' && o.v === s)
    }
    case 'equalsIgnoreCase': {
      const o = a(0)
      return jbool(o.k === 'str' && o.v.toLowerCase() === s.toLowerCase())
    }
    case 'compareTo': {
      const o = text(0)
      if (s === o) return jint(0)
      const n = Math.min(s.length, o.length)
      for (let i = 0; i < n; i++) {
        if (s.charCodeAt(i) !== o.charCodeAt(i)) return jint(s.charCodeAt(i) - o.charCodeAt(i))
      }
      return jint(s.length - o.length)
    }
    case 'compareToIgnoreCase':
      return stringMethod(jstr(s.toLowerCase()) as Val & { k: 'str' }, 'compareTo', [jstr(text(0).toLowerCase())], ctx)
    case 'toUpperCase': return same(s.toUpperCase())
    case 'toLowerCase': return same(s.toLowerCase())
    case 'trim': return same(s.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, ''))
    case 'strip': return same(s.trim())
    case 'concat': return same(s + text(0))
    case 'contains': return jbool(s.includes(text(0)))
    case 'startsWith': return jbool(args.length > 1 ? s.startsWith(text(0), num(1)) : s.startsWith(text(0)))
    case 'endsWith': return jbool(s.endsWith(text(0)))
    case 'replace': {
      const from = a(0).k === 'char' ? String.fromCharCode(asNumber(a(0))) : text(0)
      const to = a(1).k === 'char' ? String.fromCharCode(asNumber(a(1))) : text(1)
      return same(s.split(from).join(to))
    }
    case 'replaceAll': return same(s.replace(new RegExp(text(0), 'g'), text(1)))
    case 'replaceFirst': return same(s.replace(new RegExp(text(0)), text(1)))
    case 'split': {
      const limit = args.length > 1 ? num(1) : 0
      let parts = s.split(new RegExp(text(0)))
      if (limit <= 0) while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
      if (limit > 0 && parts.length > limit) {
        const head = parts.slice(0, limit - 1)
        head.push(parts.slice(limit - 1).join(text(0)))
        parts = head
      }
      return { k: 'arr', elem: { name: 'String', dims: 0 }, v: parts.map(jstrNew) }
    }
    case 'toCharArray':
      return { k: 'arr', elem: { name: 'char', dims: 0 }, v: [...s].map((c) => jchar(c.charCodeAt(0))) }
    case 'chars':
      return newList([...s].map((c) => jint(c.charCodeAt(0))))
    case 'repeat': return jstrNew(s.repeat(Math.max(0, num(0))))
    case 'matches': return jbool(new RegExp(`^(?:${text(0)})$`).test(s))
    case 'hashCode': return jint(stringHash(s))
    case 'toString': return recv
    case 'intern': return jstr(s)
    case 'format': case 'formatted': return jstrNew(javaFormat(s, args, ctx))
    case 'getClass': return T('Class', 'String')
    case 'lines': return newList(s.split('\n').map(jstrNew))
    case 'codePointAt': return jint(s.codePointAt(num(0)) ?? 0)
    default:
      throw new JavaRuntimeError(
        'NoSuchMethod',
        `Die Klasse String kennt keine Methode «${name}». Häufige String-Methoden: length(), charAt(i), substring(a,b), equals(...), indexOf(...), toUpperCase(), split(...).`,
      )
  }
}

/* --------------------------- Statische Klassen --------------------------- */

export const STATIC_CLASSES = new Set([
  'System', 'Math', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'String',
  'Arrays', 'Objects', 'Collections', 'Thread', 'Byte', 'Short', 'List', 'Map', 'Set',
])

export function staticField(cls: string, name: string): Val | undefined {
  switch (`${cls}.${name}`) {
    case 'System.out': return T('PrintStream', 'out')
    case 'System.err': return T('PrintStream', 'err')
    case 'System.in': return T('InputStream', 'in')
    case 'Math.PI': return jdouble(Math.PI)
    case 'Math.E': return jdouble(Math.E)
    case 'Integer.MAX_VALUE': return jint(2147483647)
    case 'Integer.MIN_VALUE': return jint(-2147483648)
    case 'Long.MAX_VALUE': return jlong(9223372036854775807n)
    case 'Long.MIN_VALUE': return jlong(-9223372036854775808n)
    case 'Double.MAX_VALUE': return jdouble(1.7976931348623157e308)
    case 'Double.MIN_VALUE': return jdouble(4.9e-324)
    case 'Double.POSITIVE_INFINITY': return jdouble(Infinity)
    case 'Double.NEGATIVE_INFINITY': return jdouble(-Infinity)
    case 'Double.NaN': return jdouble(NaN)
    case 'Byte.MAX_VALUE': return { k: 'byte', v: 127 }
    case 'Byte.MIN_VALUE': return { k: 'byte', v: -128 }
    case 'Short.MAX_VALUE': return { k: 'short', v: 32767 }
    case 'Short.MIN_VALUE': return { k: 'short', v: -32768 }
    case 'Character.MAX_VALUE': return jchar(65535)
    case 'Character.MIN_VALUE': return jchar(0)
    case 'Boolean.TRUE': return TRUE
    case 'Boolean.FALSE': return FALSE
  }
  return undefined
}

export function staticMethod(cls: string, name: string, args: Val[], ctx: NativeCtx): Val | undefined {
  const n = (i: number) => asNumber(unbox(args[i]))
  const s = (i: number) => ctx.str(args[i])

  if (cls === 'Math') {
    switch (name) {
      case 'abs': {
        const v = unbox(args[0])
        if (v.k === 'long') return jlong(v.v < 0n ? -v.v : v.v)
        if (v.k === 'double') return jdouble(Math.abs(v.v))
        if (v.k === 'float') return jfloat(Math.abs(v.v))
        return jint(Math.abs(v.k === 'int' || v.k === 'short' || v.k === 'byte' || v.k === 'char' ? v.v : asNumber(v)) | 0)
      }
      case 'max': case 'min': {
        const a = unbox(args[0])
        const b = unbox(args[1])
        const pick = name === 'max' ? Math.max : Math.min
        if (a.k === 'double' || b.k === 'double') return jdouble(pick(asNumber(a), asNumber(b)))
        if (a.k === 'float' || b.k === 'float') return jfloat(pick(asNumber(a), asNumber(b)))
        if (a.k === 'long' || b.k === 'long') {
          const x = asBigInt(a)
          const y = asBigInt(b)
          return jlong(name === 'max' ? (x > y ? x : y) : x < y ? x : y)
        }
        return jint(pick(asNumber(a), asNumber(b)) | 0)
      }
      case 'pow': return jdouble(Math.pow(n(0), n(1)))
      case 'sqrt': return jdouble(Math.sqrt(n(0)))
      case 'cbrt': return jdouble(Math.cbrt(n(0)))
      case 'random': return jdouble(Math.random())
      case 'round': {
        const v = unbox(args[0])
        if (v.k === 'float') return jint(Math.floor(v.v + 0.5) | 0)
        return jlong(BigInt(Math.floor(asNumber(v) + 0.5)))
      }
      case 'floor': return jdouble(Math.floor(n(0)))
      case 'ceil': return jdouble(Math.ceil(n(0)))
      case 'rint': return jdouble(rint(n(0)))
      case 'exp': return jdouble(Math.exp(n(0)))
      case 'log': return jdouble(Math.log(n(0)))
      case 'log10': return jdouble(Math.log10(n(0)))
      case 'sin': return jdouble(Math.sin(n(0)))
      case 'cos': return jdouble(Math.cos(n(0)))
      case 'tan': return jdouble(Math.tan(n(0)))
      case 'asin': return jdouble(Math.asin(n(0)))
      case 'acos': return jdouble(Math.acos(n(0)))
      case 'atan': return jdouble(Math.atan(n(0)))
      case 'atan2': return jdouble(Math.atan2(n(0), n(1)))
      case 'hypot': return jdouble(Math.hypot(n(0), n(1)))
      case 'signum': return jdouble(Math.sign(n(0)))
      case 'toRadians': return jdouble((n(0) * Math.PI) / 180)
      case 'toDegrees': return jdouble((n(0) * 180) / Math.PI)
      case 'floorDiv': return jint(Math.floor(n(0) / n(1)) | 0)
      case 'floorMod': return jint((((n(0) % n(1)) + n(1)) % n(1)) | 0)
      case 'addExact': return jint((n(0) + n(1)) | 0)
      case 'multiplyExact': return jint(Math.imul(n(0), n(1)))
    }
  }

  if (cls === 'System') {
    switch (name) {
      case 'currentTimeMillis': return jlong(BigInt(Date.now()))
      case 'nanoTime': return jlong(BigInt(Math.round(performance.now() * 1e6)))
      case 'exit': return ctx.exit(args.length ? Math.trunc(n(0)) : 0)
      case 'lineSeparator': return jstr('\n')
      case 'arraycopy': {
        const src = args[0]
        const dst = args[2]
        if (src.k !== 'arr' || dst.k !== 'arr') throw new JavaRuntimeError('ArrayStoreException', 'System.arraycopy erwartet Arrays.')
        const sp = Math.trunc(n(1))
        const dp = Math.trunc(n(3))
        const len = Math.trunc(n(4))
        if (sp < 0 || dp < 0 || len < 0 || sp + len > src.v.length || dp + len > dst.v.length) {
          throw new JavaRuntimeError('ArrayIndexOutOfBoundsException', 'arraycopy: Bereich liegt außerhalb des Arrays.')
        }
        const slice = src.v.slice(sp, sp + len)
        for (let i = 0; i < len; i++) dst.v[dp + i] = slice[i]
        return NULL
      }
      case 'getProperty': return jstr('')
    }
  }

  if (cls === 'Integer' || cls === 'Short' || cls === 'Byte') {
    switch (name) {
      case 'parseInt': case 'parseShort': case 'parseByte': {
        /* Java trimmt hier bewusst NICHT — " 8" wirft eine NumberFormatException. */
        const raw = s(0)
        const radix = args.length > 1 ? Math.trunc(n(1)) : 10
        const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, radix)
        const body = raw.replace(/^[+-]/, '')
        const valid = body.length > 0 && [...body.toLowerCase()].every((c) => digits.includes(c))
        if (!valid) throw new JavaRuntimeError('NumberFormatException', `For input string: "${raw}"`)
        return jint(parseInt(raw, radix) | 0)
      }
      case 'valueOf': {
        const v = unbox(args[0])
        if (v.k === 'str') return jint(parseInt(v.v.trim(), args.length > 1 ? Math.trunc(n(1)) : 10) | 0)
        return jint(asNumber(v) | 0)
      }
      case 'toString': return jstr(args.length > 1 ? (asNumber(unbox(args[0])) | 0).toString(Math.trunc(n(1))) : String(asNumber(unbox(args[0])) | 0))
      case 'toBinaryString': return jstr((asNumber(unbox(args[0])) >>> 0).toString(2))
      case 'toHexString': return jstr((asNumber(unbox(args[0])) >>> 0).toString(16))
      case 'toOctalString': return jstr((asNumber(unbox(args[0])) >>> 0).toString(8))
      case 'compare': return jint(Math.sign(n(0) - n(1)))
      case 'max': return jint(Math.max(n(0), n(1)) | 0)
      case 'min': return jint(Math.min(n(0), n(1)) | 0)
      case 'sum': return jint((n(0) + n(1)) | 0)
      case 'bitCount': {
        let x = asNumber(unbox(args[0])) >>> 0
        let c = 0
        while (x) {
          c += x & 1
          x >>>= 1
        }
        return jint(c)
      }
    }
  }

  if (cls === 'Long') {
    switch (name) {
      case 'parseLong': {
        const raw = s(0).trim()
        try {
          return jlong(BigInt(raw))
        } catch {
          throw new JavaRuntimeError('NumberFormatException', `For input string: "${s(0)}"`)
        }
      }
      case 'valueOf': return jlong(asBigInt(unbox(args[0])))
      case 'toString': return jstr(asBigInt(unbox(args[0])).toString())
      case 'compare': {
        const x = asBigInt(unbox(args[0]))
        const y = asBigInt(unbox(args[1]))
        return jint(x < y ? -1 : x > y ? 1 : 0)
      }
      case 'max': { const x = asBigInt(unbox(args[0])); const y = asBigInt(unbox(args[1])); return jlong(x > y ? x : y) }
      case 'min': { const x = asBigInt(unbox(args[0])); const y = asBigInt(unbox(args[1])); return jlong(x < y ? x : y) }
    }
  }

  if (cls === 'Double' || cls === 'Float') {
    switch (name) {
      case 'parseDouble': case 'parseFloat': {
        const raw = s(0).trim()
        if (!/^[+-]?((\d+\.?\d*)|(\.\d+))([eE][+-]?\d+)?[fFdD]?$/.test(raw)) {
          throw new JavaRuntimeError('NumberFormatException', `For input string: "${s(0)}"`)
        }
        const v = Number(raw.replace(/[fFdD]$/, ''))
        return cls === 'Float' ? jfloat(v) : jdouble(v)
      }
      case 'valueOf': {
        const v = unbox(args[0])
        return cls === 'Float' ? jfloat(v.k === 'str' ? Number(v.v) : asNumber(v)) : jdouble(v.k === 'str' ? Number(v.v) : asNumber(v))
      }
      case 'toString': return jstr(cls === 'Float' ? javaFloatToString(n(0)) : javaDoubleToString(n(0)))
      case 'compare': return jint(Math.sign(n(0) - n(1)))
      case 'isNaN': return jbool(Number.isNaN(n(0)))
      case 'isInfinite': return jbool(!Number.isFinite(n(0)) && !Number.isNaN(n(0)))
      case 'max': return jdouble(Math.max(n(0), n(1)))
      case 'min': return jdouble(Math.min(n(0), n(1)))
      case 'sum': return jdouble(n(0) + n(1))
    }
  }

  if (cls === 'Boolean') {
    switch (name) {
      case 'parseBoolean': return jbool(s(0).toLowerCase() === 'true')
      case 'valueOf': {
        const v = unbox(args[0])
        return jbool(v.k === 'str' ? v.v.toLowerCase() === 'true' : asBoolean(v))
      }
      case 'toString': return jstr(String(asBoolean(unbox(args[0]))))
      case 'compare': return jint(Number(asBoolean(unbox(args[0]))) - Number(asBoolean(unbox(args[1]))))
    }
  }

  if (cls === 'Character') {
    const ch = () => {
      const v = unbox(args[0])
      return v.k === 'str' ? v.v.charAt(0) : String.fromCharCode(asNumber(v))
    }
    switch (name) {
      case 'isDigit': return jbool(/^[0-9]$/.test(ch()))
      case 'isLetter': return jbool(/^\p{L}$/u.test(ch()))
      case 'isLetterOrDigit': return jbool(/^[\p{L}0-9]$/u.test(ch()))
      case 'isUpperCase': return jbool(/^\p{Lu}$/u.test(ch()))
      case 'isLowerCase': return jbool(/^\p{Ll}$/u.test(ch()))
      case 'isWhitespace': case 'isSpaceChar': return jbool(/^\s$/.test(ch()))
      case 'isAlphabetic': return jbool(/^\p{L}$/u.test(ch()))
      case 'toUpperCase': return jchar(ch().toUpperCase().charCodeAt(0))
      case 'toLowerCase': return jchar(ch().toLowerCase().charCodeAt(0))
      case 'getNumericValue': {
        const c = ch()
        if (/[0-9]/.test(c)) return jint(Number(c))
        if (/[a-z]/i.test(c)) return jint(c.toLowerCase().charCodeAt(0) - 87)
        return jint(-1)
      }
      case 'valueOf': return jchar(ch().charCodeAt(0))
      case 'toString': return jstr(ch())
      case 'compare': return jint(asNumber(unbox(args[0])) - asNumber(unbox(args[1])))
      case 'digit': return jint(parseInt(ch(), Math.trunc(n(1))))
    }
  }

  if (cls === 'String') {
    switch (name) {
      case 'valueOf': return jstrNew(ctx.str(args[0]))
      case 'format': return jstrNew(javaFormat(s(0), args.slice(1), ctx))
      case 'join': {
        const sep = s(0)
        const rest = args.length === 2 && (args[1].k === 'arr' || args[1].k === 'nat')
          ? iterableToArray(args[1], ctx)
          : args.slice(1)
        return jstrNew(rest.map((v) => ctx.str(v)).join(sep))
      }
      case 'copyValueOf': return jstrNew(ctx.str(args[0]))
    }
  }

  if (cls === 'Arrays') {
    const arr = () => {
      const a = args[0]
      if (a.k !== 'arr') throw new JavaRuntimeError('IncompatibleTypes', 'Arrays.' + name + ' erwartet ein Array.')
      return a
    }
    switch (name) {
      case 'toString': {
        if (args[0].k === 'null') return jstr('null')
        return jstr('[' + arr().v.map((v) => ctx.str(v)).join(', ') + ']')
      }
      case 'deepToString': {
        const deep = (v: Val): string => (v.k === 'arr' ? '[' + v.v.map(deep).join(', ') + ']' : ctx.str(v))
        return jstr(deep(args[0]))
      }
      case 'sort': {
        const a = arr()
        const from = args.length > 2 ? Math.trunc(n(1)) : 0
        const to = args.length > 2 ? Math.trunc(n(2)) : a.v.length
        const part = a.v.slice(from, to).sort((x, y) => ctx.compareValues(x, y))
        for (let i = 0; i < part.length; i++) a.v[from + i] = part[i]
        return NULL
      }
      case 'fill': {
        const a = arr()
        for (let i = 0; i < a.v.length; i++) a.v[i] = args[1]
        return NULL
      }
      case 'copyOf': {
        const a = arr()
        const len = Math.trunc(n(1))
        const out: Val[] = []
        for (let i = 0; i < len; i++) out.push(a.v[i] ?? defaultForElem(a.elem))
        return { k: 'arr', elem: a.elem, v: out }
      }
      case 'copyOfRange': {
        const a = arr()
        return { k: 'arr', elem: a.elem, v: a.v.slice(Math.trunc(n(1)), Math.trunc(n(2))) }
      }
      case 'equals': {
        const a = args[0]
        const b = args[1]
        if (a.k !== 'arr' || b.k !== 'arr') return jbool(a === b)
        return jbool(a.v.length === b.v.length && a.v.every((x, i) => ctx.valueEquals(x, b.v[i])))
      }
      case 'asList': return newList(args.length === 1 && args[0].k === 'arr' ? [...args[0].v] : [...args])
      case 'stream': return newList([...arr().v])
      case 'binarySearch': {
        const a = arr()
        let lo = 0
        let hi = a.v.length - 1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          const c = ctx.compareValues(a.v[mid], args[1])
          if (c === 0) return jint(mid)
          if (c < 0) lo = mid + 1
          else hi = mid - 1
        }
        return jint(-(lo + 1))
      }
    }
  }

  if (cls === 'Objects') {
    switch (name) {
      case 'equals': return jbool(ctx.valueEquals(args[0], args[1]))
      case 'toString': return jstr(ctx.str(args[0]))
      case 'isNull': return jbool(args[0].k === 'null')
      case 'nonNull': return jbool(args[0].k !== 'null')
      case 'hash': return jint(args.reduce((h, v) => (Math.imul(31, h) + hashOf(v, ctx)) | 0, 1))
      case 'hashCode': return jint(hashOf(args[0], ctx))
      case 'requireNonNull':
        if (args[0].k === 'null') throw new JavaRuntimeError('NullPointerException', args.length > 1 ? s(1) : '')
        return args[0]
    }
  }

  if (cls === 'Collections') {
    const list = () => (args[0].k === 'nat' ? (args[0].v as JList) : null)
    switch (name) {
      case 'sort': {
        const l = list()
        if (l) {
          if (args.length > 1) l.items.sort((x, y) => Math.trunc(asNumber(ctx.callFunctional(args[1], [x, y]))))
          else l.items.sort((x, y) => ctx.compareValues(x, y))
        }
        return NULL
      }
      case 'reverse': { list()?.items.reverse(); return NULL }
      case 'shuffle': {
        const l = list()
        if (l) for (let i = l.items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[l.items[i], l.items[j]] = [l.items[j], l.items[i]]
        }
        return NULL
      }
      case 'max': {
        const items = iterableToArray(args[0], ctx)
        return items.reduce((m, v) => (ctx.compareValues(v, m) > 0 ? v : m))
      }
      case 'min': {
        const items = iterableToArray(args[0], ctx)
        return items.reduce((m, v) => (ctx.compareValues(v, m) < 0 ? v : m))
      }
      case 'unmodifiableList': case 'unmodifiableSet': case 'unmodifiableMap': return args[0]
      case 'emptyList': return newList([])
      case 'nCopies': return newList(new Array(Math.trunc(n(0))).fill(args[1]))
    }
  }

  if (cls === 'List' || cls === 'Set') {
    if (name === 'of') return cls === 'List' ? newList([...args]) : setOf(args, ctx)
    if (name === 'copyOf') return newList(iterableToArray(args[0], ctx))
  }
  if (cls === 'Map' && name === 'of') {
    const m = newMap()
    for (let i = 0; i + 1 < args.length; i += 2) mapPut(m.v as JMap, args[i], args[i + 1], ctx)
    return m
  }

  if (cls === 'Thread') {
    /* Nebenläufigkeit wird deterministisch abgebildet: start() führt run()
       direkt aus. Für die Klausurfragen zu Threads reicht das, echte
       Verzahnung ist im Browser ohnehin nicht reproduzierbar. */
    if (name === 'sleep' || name === 'yield' || name === 'onSpinWait') return NULL
    if (name === 'currentThread') return T('Thread', { name: 'main' })
  }

  return undefined
}

function setOf(args: Val[], ctx: NativeCtx): Val {
  const s = newSet()
  for (const a of args) setAdd(s.v as JSet, a, ctx)
  return s
}

function defaultForElem(elem: TypeRef): Val {
  switch (elem.name) {
    case 'int': return jint(0)
    case 'long': return jlong(0n)
    case 'double': return jdouble(0)
    case 'float': return jfloat(0)
    case 'char': return jchar(0)
    case 'boolean': return FALSE
    case 'byte': return { k: 'byte', v: 0 }
    case 'short': return { k: 'short', v: 0 }
    default: return NULL
  }
}

export function mapPut(m: JMap, key: Val, value: Val, ctx: NativeCtx): Val {
  const k = keyOf(key, ctx)
  const old = m.entries.get(k)
  m.entries.set(k, { key, value, seq: old ? old.seq : m.seq++ })
  return old ? old.value : NULL
}
export function setAdd(s: JSet, key: Val, ctx: NativeCtx): boolean {
  const k = keyOf(key, ctx)
  if (s.entries.has(k)) return false
  s.entries.set(k, { key, seq: s.seq++ })
  return true
}

function rint(x: number): number {
  const f = Math.floor(x)
  const diff = x - f
  if (diff < 0.5) return f
  if (diff > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

/* ------------------------- Native Objektmethoden ------------------------- */

export function nativeMethod(recv: Val & { k: 'nat' }, name: string, args: Val[], ctx: NativeCtx): Val {
  const n = (i: number) => Math.trunc(asNumber(unbox(args[i])))

  switch (recv.tag) {
    /* ---------------- System.out / System.err ---------------- */
    case 'PrintStream': {
      const toErr = recv.v === 'err'
      /* println(char[]) gibt in Java die Zeichen aus, nicht die Referenz */
      const shown = () => {
        const a = args[0]
        if (a && a.k === 'arr' && a.elem.name === 'char' && a.elem.dims === 0) {
          return a.v.map((c) => String.fromCharCode(asNumber(unbox(c)))).join('')
        }
        return ctx.str(a)
      }
      switch (name) {
        case 'println':
          ctx.print((args.length ? shown() : '') + '\n', toErr)
          return NULL
        case 'print':
          ctx.print(args.length ? shown() : '', toErr)
          return NULL
        case 'printf': case 'format':
          ctx.print(javaFormat(ctx.str(args[0]), args.slice(1), ctx), toErr)
          return NULL
        case 'flush': case 'close': return NULL
      }
      break
    }

    /* -------------------- StringBuilder -------------------- */
    case 'StringBuilder': {
      const box = recv.v as { s: string }
      switch (name) {
        case 'append': box.s += ctx.str(args[0]); return recv
        case 'toString': return jstrNew(box.s)
        case 'length': return jint(box.s.length)
        case 'charAt': {
          const i = n(0)
          if (i < 0 || i >= box.s.length) throw new JavaRuntimeError('StringIndexOutOfBoundsException', `index ${i}, length ${box.s.length}`)
          return jchar(box.s.charCodeAt(i))
        }
        case 'reverse': box.s = [...box.s].reverse().join(''); return recv
        case 'insert': box.s = box.s.slice(0, n(0)) + ctx.str(args[1]) + box.s.slice(n(0)); return recv
        case 'deleteCharAt': box.s = box.s.slice(0, n(0)) + box.s.slice(n(0) + 1); return recv
        case 'delete': box.s = box.s.slice(0, n(0)) + box.s.slice(n(1)); return recv
        case 'replace': box.s = box.s.slice(0, n(0)) + ctx.str(args[2]) + box.s.slice(n(1)); return recv
        case 'setCharAt': box.s = box.s.slice(0, n(0)) + String.fromCharCode(asNumber(unbox(args[1]))) + box.s.slice(n(0) + 1); return NULL
        case 'setLength': box.s = box.s.slice(0, n(0)).padEnd(n(0), '\0'); return NULL
        case 'indexOf': return jint(box.s.indexOf(ctx.str(args[0])))
        case 'substring': return jstrNew(args.length > 1 ? box.s.slice(n(0), n(1)) : box.s.slice(n(0)))
        case 'isEmpty': return jbool(box.s.length === 0)
      }
      break
    }

    /* ---------------------- Listen ---------------------- */
    case 'ArrayList': {
      const l = recv.v as JList
      switch (name) {
        case 'add':
          if (args.length === 2) {
            l.items.splice(n(0), 0, args[1])
            return NULL
          }
          l.items.push(args[0])
          return TRUE
        case 'addAll': {
          const src = args.length === 2 ? args[1] : args[0]
          const at = args.length === 2 ? n(0) : l.items.length
          l.items.splice(at, 0, ...iterableToArray(src, ctx))
          return TRUE
        }
        case 'get': {
          const i = n(0)
          if (i < 0 || i >= l.items.length) {
            throw new JavaRuntimeError('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${l.items.length}`)
          }
          return l.items[i]
        }
        case 'set': {
          const i = n(0)
          if (i < 0 || i >= l.items.length) {
            throw new JavaRuntimeError('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${l.items.length}`)
          }
          const old = l.items[i]
          l.items[i] = args[1]
          return old
        }
        case 'remove': {
          const a = unbox(args[0])
          if (a.k === 'int' || a.k === 'short' || a.k === 'byte') {
            const i = a.v
            if (i < 0 || i >= l.items.length) {
              throw new JavaRuntimeError('IndexOutOfBoundsException', `Index ${i} out of bounds for length ${l.items.length}`)
            }
            return l.items.splice(i, 1)[0]
          }
          const idx = l.items.findIndex((x) => ctx.valueEquals(x, args[0]))
          if (idx < 0) return FALSE
          l.items.splice(idx, 1)
          return TRUE
        }
        case 'size': return jint(l.items.length)
        case 'isEmpty': return jbool(l.items.length === 0)
        case 'contains': return jbool(l.items.some((x) => ctx.valueEquals(x, args[0])))
        case 'indexOf': return jint(l.items.findIndex((x) => ctx.valueEquals(x, args[0])))
        case 'lastIndexOf': {
          for (let i = l.items.length - 1; i >= 0; i--) if (ctx.valueEquals(l.items[i], args[0])) return jint(i)
          return jint(-1)
        }
        case 'clear': l.items.length = 0; return NULL
        case 'toString': return jstr('[' + l.items.map((v) => ctx.str(v)).join(', ') + ']')
        case 'sort':
          if (args.length && args[0].k !== 'null') l.items.sort((x, y) => Math.trunc(asNumber(ctx.callFunctional(args[0], [x, y]))))
          else l.items.sort((x, y) => ctx.compareValues(x, y))
          return NULL
        case 'forEach': l.items.forEach((v) => ctx.callFunctional(args[0], [v])); return NULL
        case 'subList': return newList(l.items.slice(n(0), n(1)))
        case 'iterator': return T('Iterator', { items: [...l.items], i: 0 })
        case 'toArray': return { k: 'arr', elem: { name: 'Object', dims: 0 }, v: [...l.items] }
        case 'stream': case 'reversed': return newList(name === 'reversed' ? [...l.items].reverse() : [...l.items])
        case 'equals': {
          const o = args[0]
          if (o.k !== 'nat' || o.tag !== 'ArrayList') return FALSE
          const ol = o.v as JList
          return jbool(ol.items.length === l.items.length && l.items.every((x, i) => ctx.valueEquals(x, ol.items[i])))
        }
        case 'hashCode': return jint(l.items.reduce((h, v) => (Math.imul(31, h) + hashOf(v, ctx)) | 0, 1))
      }
      break
    }

    /* ---------------------- Iterator ---------------------- */
    case 'Iterator': {
      const it = recv.v as { items: Val[]; i: number }
      if (name === 'hasNext') return jbool(it.i < it.items.length)
      if (name === 'next') {
        if (it.i >= it.items.length) throw new JavaRuntimeError('NoSuchElementException', '')
        return it.items[it.i++]
      }
      break
    }

    /* ------------------------ Maps ------------------------ */
    case 'HashMap': {
      const m = recv.v as JMap
      switch (name) {
        case 'put': return mapPut(m, args[0], args[1], ctx)
        case 'putIfAbsent': {
          const k = keyOf(args[0], ctx)
          if (m.entries.has(k)) return m.entries.get(k)!.value
          return mapPut(m, args[0], args[1], ctx)
        }
        case 'get': {
          const e = m.entries.get(keyOf(args[0], ctx))
          return e ? e.value : NULL
        }
        case 'getOrDefault': {
          const e = m.entries.get(keyOf(args[0], ctx))
          return e ? e.value : args[1]
        }
        case 'containsKey': return jbool(m.entries.has(keyOf(args[0], ctx)))
        case 'containsValue': return jbool([...m.entries.values()].some((e) => ctx.valueEquals(e.value, args[0])))
        case 'remove': {
          const k = keyOf(args[0], ctx)
          const e = m.entries.get(k)
          m.entries.delete(k)
          return e ? e.value : NULL
        }
        case 'size': return jint(m.entries.size)
        case 'isEmpty': return jbool(m.entries.size === 0)
        case 'clear': m.entries.clear(); return NULL
        case 'keySet': return T('KeySet', mapEntriesOrdered(m, ctx).map((e) => e.key))
        case 'values': return T('Values', mapEntriesOrdered(m, ctx).map((e) => e.value))
        case 'entrySet': return T('EntrySet', mapEntriesOrdered(m, ctx).map((e) => T('MapEntry', e)))
        case 'forEach':
          for (const e of mapEntriesOrdered(m, ctx)) ctx.callFunctional(args[0], [e.key, e.value])
          return NULL
        case 'toString':
          return jstr('{' + mapEntriesOrdered(m, ctx).map((e) => `${ctx.str(e.key)}=${ctx.str(e.value)}`).join(', ') + '}')
        case 'merge': {
          const k = keyOf(args[0], ctx)
          const e = m.entries.get(k)
          const nv = e ? ctx.callFunctional(args[2], [e.value, args[1]]) : args[1]
          return mapPut(m, args[0], nv, ctx)
        }
        case 'computeIfAbsent': {
          const k = keyOf(args[0], ctx)
          const e = m.entries.get(k)
          if (e) return e.value
          const nv = ctx.callFunctional(args[1], [args[0]])
          mapPut(m, args[0], nv, ctx)
          return nv
        }
      }
      break
    }

    case 'MapEntry': {
      const e = recv.v as { key: Val; value: Val }
      if (name === 'getKey') return e.key
      if (name === 'getValue') return e.value
      if (name === 'toString') return jstr(`${ctx.str(e.key)}=${ctx.str(e.value)}`)
      break
    }

    /* ------------------------ Mengen ------------------------ */
    case 'HashSet': {
      const s = recv.v as JSet
      switch (name) {
        case 'add': return jbool(setAdd(s, args[0], ctx))
        case 'addAll': {
          let changed = false
          for (const v of iterableToArray(args[0], ctx)) changed = setAdd(s, v, ctx) || changed
          return jbool(changed)
        }
        case 'contains': return jbool(s.entries.has(keyOf(args[0], ctx)))
        case 'remove': return jbool(s.entries.delete(keyOf(args[0], ctx)))
        case 'size': return jint(s.entries.size)
        case 'isEmpty': return jbool(s.entries.size === 0)
        case 'clear': s.entries.clear(); return NULL
        case 'iterator': return T('Iterator', { items: setEntriesOrdered(s, ctx).map((e) => e.key), i: 0 })
        case 'forEach':
          for (const e of setEntriesOrdered(s, ctx)) ctx.callFunctional(args[0], [e.key])
          return NULL
        case 'toString': return jstr('[' + setEntriesOrdered(s, ctx).map((e) => ctx.str(e.key)).join(', ') + ']')
      }
      break
    }

    case 'KeySet': case 'Values': case 'EntrySet': {
      const items = recv.v as Val[]
      switch (name) {
        case 'size': return jint(items.length)
        case 'isEmpty': return jbool(items.length === 0)
        case 'contains': return jbool(items.some((x) => ctx.valueEquals(x, args[0])))
        case 'iterator': return T('Iterator', { items: [...items], i: 0 })
        case 'toString': return jstr('[' + items.map((v) => ctx.str(v)).join(', ') + ']')
        case 'forEach': items.forEach((v) => ctx.callFunctional(args[0], [v])); return NULL
        case 'stream': return newList([...items])
      }
      break
    }

    /* ------------------------ Scanner ------------------------ */
    case 'Scanner': {
      switch (name) {
        case 'nextLine': {
          const l = ctx.readLine()
          if (l === null) throw new JavaRuntimeError('NoSuchElementException', 'No line found')
          return jstrNew(l)
        }
        case 'next': {
          const t = ctx.readToken()
          if (t === null) throw new JavaRuntimeError('NoSuchElementException', '')
          return jstrNew(t)
        }
        case 'nextInt': {
          const t = ctx.readToken()
          if (t === null) throw new JavaRuntimeError('NoSuchElementException', '')
          if (!/^[+-]?\d+$/.test(t)) throw new JavaRuntimeError('InputMismatchException', `«${t}» ist keine ganze Zahl.`)
          return jint(parseInt(t, 10) | 0)
        }
        case 'nextLong': {
          const t = ctx.readToken()
          if (t === null) throw new JavaRuntimeError('NoSuchElementException', '')
          return jlong(BigInt(t))
        }
        case 'nextDouble': case 'nextFloat': {
          const t = ctx.readToken()
          if (t === null) throw new JavaRuntimeError('NoSuchElementException', '')
          const v = Number(t.replace(',', '.'))
          if (Number.isNaN(v)) throw new JavaRuntimeError('InputMismatchException', `«${t}» ist keine Zahl.`)
          return name === 'nextFloat' ? jfloat(v) : jdouble(v)
        }
        case 'nextBoolean': {
          const t = ctx.readToken()
          return jbool(t?.toLowerCase() === 'true')
        }
        case 'hasNext': return jbool(ctx.hasMoreInput('token'))
        case 'hasNextLine': return jbool(ctx.hasMoreInput('line'))
        case 'hasNextInt': return jbool(ctx.hasMoreInput('int'))
        case 'close': return NULL
      }
      break
    }

    /* ------------------------- Random ------------------------- */
    case 'Random': {
      const state = recv.v as { next: () => number }
      switch (name) {
        case 'nextInt': {
          if (args.length === 0) return jint((state.next() * 4294967296 - 2147483648) | 0)
          if (args.length === 2) return jint((n(0) + Math.floor(state.next() * (n(1) - n(0)))) | 0)
          return jint(Math.floor(state.next() * n(0)) | 0)
        }
        case 'nextDouble': case 'nextFloat': return jdouble(state.next())
        case 'nextBoolean': return jbool(state.next() < 0.5)
        case 'nextLong': return jlong(BigInt(Math.floor(state.next() * 1e15)))
        case 'nextGaussian': {
          // Box-Muller-Transformation
          const u = Math.max(1e-12, state.next())
          const v = state.next()
          return jdouble(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))
        }
        case 'setSeed': return NULL
      }
      break
    }

    /* -------------------- Hüllklassen -------------------- */
    case 'Integer': case 'Double': case 'Long': case 'Character': case 'Boolean': case 'Float': {
      const inner = unbox(recv)
      switch (name) {
        case 'intValue': return jint(asNumber(inner) | 0)
        case 'doubleValue': return jdouble(asNumber(inner))
        case 'longValue': return jlong(asBigInt(inner))
        case 'charValue': return jchar(asNumber(inner))
        case 'booleanValue': return jbool(asBoolean(inner))
        case 'toString': return jstr(ctx.str(inner))
        case 'equals': return jbool(ctx.valueEquals(inner, unbox(args[0])))
        case 'compareTo': return jint(ctx.compareValues(inner, unbox(args[0])))
        case 'hashCode': return jint(hashOf(inner, ctx))
      }
      break
    }

    /* ------------------ eingebaute Ausnahmen ------------------ */
    case 'Throwable': {
      const t = recv.v as { type: string; message: string }
      switch (name) {
        case 'getMessage': case 'getLocalizedMessage':
          return t.message ? jstr(t.message) : NULL
        case 'toString': return jstr(t.message ? `${t.type}: ${t.message}` : t.type)
        case 'printStackTrace':
          ctx.print(`${t.type}${t.message ? ': ' + t.message : ''}\n\tat Main.main(Main.java)\n`, true)
          return NULL
        case 'getClass': return T('Class', t.type)
        case 'getCause': return NULL
        case 'getStackTrace': return { k: 'arr', elem: { name: 'String', dims: 0 }, v: [] }
      }
      break
    }

    case 'Thread': {
      const th = recv.v as { name: string; runnable?: Val }
      switch (name) {
        case 'start': case 'run':
          if (th.runnable) ctx.callFunctional(th.runnable, [])
          return NULL
        case 'join': case 'interrupt': case 'setDaemon': case 'setPriority': return NULL
        case 'isAlive': case 'isInterrupted': return jbool(false)
        case 'getName': return jstr(th.name ?? 'main')
        case 'setName': th.name = ctx.str(args[0]); return NULL
        case 'getId': return jlong(1n)
      }
      break
    }

    case 'Object':
      if (name === 'toString') return jstr(`java.lang.Object@${(Math.random() * 1e9) | 0}`)
      if (name === 'equals') return jbool(recv === args[0])
      if (name === 'hashCode') return jint(0)
      if (name === 'getClass') return T('Class', 'Object')
      break

    case 'Class':
      if (name === 'getName' || name === 'getSimpleName') return jstr(String(recv.v))
      break
  }

  throw new JavaRuntimeError('NoSuchMethod', `${recv.tag} kennt keine Methode «${name}(…)».`)
}

/* -------------------------- Konstruktoren -------------------------- */

export function constructNative(cls: string, args: Val[], ctx: NativeCtx): Val | undefined {
  switch (cls) {
    case 'StringBuilder': case 'StringBuffer':
      return T('StringBuilder', { s: args.length && args[0].k === 'str' ? args[0].v : '' })
    case 'String':
      if (args.length === 0) return jstrNew('')
      if (args[0].k === 'arr') return jstrNew(args[0].v.map((c) => String.fromCharCode(asNumber(c))).join(''))
      return jstrNew(ctx.str(args[0]))
    case 'ArrayList': case 'LinkedList': case 'Vector':
      return newList(args.length && (args[0].k === 'nat' || args[0].k === 'arr') ? iterableToArray(args[0], ctx) : [])
    case 'HashMap': case 'LinkedHashMap': case 'Hashtable':
      return newMap(false)
    case 'TreeMap':
      return newMap(true)
    case 'HashSet': case 'LinkedHashSet': {
      const s = newSet(false)
      if (args.length && (args[0].k === 'nat' || args[0].k === 'arr')) {
        for (const v of iterableToArray(args[0], ctx)) setAdd(s.v as JSet, v, ctx)
      }
      return s
    }
    case 'TreeSet': {
      const s = newSet(true)
      if (args.length && (args[0].k === 'nat' || args[0].k === 'arr')) {
        for (const v of iterableToArray(args[0], ctx)) setAdd(s.v as JSet, v, ctx)
      }
      return s
    }
    case 'Scanner':
      return T('Scanner', {})
    case 'Random': {
      let seed = args.length ? Number(asBigInt(unbox(args[0])) & 0xffffffffn) >>> 0 : (Math.random() * 4294967296) >>> 0
      const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 4294967296
      }
      return T('Random', { next })
    }
    case 'Integer': return jint(asNumber(unbox(args[0])) | 0)
    case 'Double': return jdouble(asNumber(unbox(args[0])))
    case 'Boolean': return jbool(asBoolean(unbox(args[0])))
    case 'Object': return T('Object', {})
    case 'Thread': return T('Thread', { name: 'Thread-0', runnable: args[0] })
  }
  return undefined
}

/* ------------------ Bewusst nicht unterstützte Teile ------------------ */

/**
 * Diese Klassen gehören zu Java, lassen sich im Browser aber nicht sinnvoll
 * nachbilden. Statt einer nichtssagenden „Symbol nicht gefunden"-Meldung
 * bekommt man hier den Grund und weiß, dass nicht der eigene Code schuld ist.
 */
export const UNSUPPORTED_CLASSES: Record<string, string> = {
  File: 'Dateizugriff',
  FileReader: 'Dateizugriff',
  FileWriter: 'Dateizugriff',
  FileInputStream: 'Dateizugriff',
  FileOutputStream: 'Dateizugriff',
  BufferedReader: 'Dateizugriff',
  BufferedWriter: 'Dateizugriff',
  PrintWriter: 'Dateizugriff',
  ObjectInputStream: 'Serialisierung',
  ObjectOutputStream: 'Serialisierung',
  Serializable: 'Serialisierung',
  Socket: 'Netzwerk',
  ServerSocket: 'Netzwerk',
  DatagramSocket: 'Netzwerk',
  URL: 'Netzwerk',
  HttpURLConnection: 'Netzwerk',
  JFrame: 'grafische Oberflächen',
  JPanel: 'grafische Oberflächen',
  JButton: 'grafische Oberflächen',
  Files: 'Dateizugriff',
  Paths: 'Dateizugriff',
}

export function unsupportedMessage(name: string): string | null {
  const area = UNSUPPORTED_CLASSES[name]
  if (!area) return null
  return (
    `${name} gehört zum Bereich ${area}. Den gibt es im Browser nicht — ` +
    'dieser Compiler kennt keine Dateien, kein Netzwerk und keine Fenster. ' +
    'Die Aufgabe lässt sich hier nicht ausführen; vergleiche deine Lösung mit der Musterlösung.'
  )
}

/* -------------------- Eingebaute Ausnahmeklassen -------------------- */

export const BUILTIN_EXCEPTIONS: Record<string, string[]> = {
  Throwable: [],
  Exception: ['Throwable'],
  RuntimeException: ['Exception', 'Throwable'],
  Error: ['Throwable'],
  ArithmeticException: ['RuntimeException', 'Exception', 'Throwable'],
  NullPointerException: ['RuntimeException', 'Exception', 'Throwable'],
  ClassCastException: ['RuntimeException', 'Exception', 'Throwable'],
  IllegalArgumentException: ['RuntimeException', 'Exception', 'Throwable'],
  IllegalStateException: ['RuntimeException', 'Exception', 'Throwable'],
  NumberFormatException: ['IllegalArgumentException', 'RuntimeException', 'Exception', 'Throwable'],
  IndexOutOfBoundsException: ['RuntimeException', 'Exception', 'Throwable'],
  ArrayIndexOutOfBoundsException: ['IndexOutOfBoundsException', 'RuntimeException', 'Exception', 'Throwable'],
  StringIndexOutOfBoundsException: ['IndexOutOfBoundsException', 'RuntimeException', 'Exception', 'Throwable'],
  NoSuchElementException: ['RuntimeException', 'Exception', 'Throwable'],
  InputMismatchException: ['NoSuchElementException', 'RuntimeException', 'Exception', 'Throwable'],
  UnsupportedOperationException: ['RuntimeException', 'Exception', 'Throwable'],
  ArrayStoreException: ['RuntimeException', 'Exception', 'Throwable'],
  NegativeArraySizeException: ['RuntimeException', 'Exception', 'Throwable'],
  ConcurrentModificationException: ['RuntimeException', 'Exception', 'Throwable'],
  StackOverflowError: ['Error', 'Throwable'],
  OutOfMemoryError: ['Error', 'Throwable'],
  IOException: ['Exception', 'Throwable'],
  FileNotFoundException: ['IOException', 'Exception', 'Throwable'],
  InterruptedException: ['Exception', 'Throwable'],
  CloneNotSupportedException: ['Exception', 'Throwable'],
  MissingFormatArgumentException: ['IllegalArgumentException', 'RuntimeException', 'Exception', 'Throwable'],
}

export { refEquals }
