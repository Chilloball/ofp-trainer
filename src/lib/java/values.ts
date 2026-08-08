import type { TypeRef } from './ast'
/* Reiner Typ-Import: zur Laufzeit entsteht dadurch keine Abhängigkeit
   zurück auf den Interpreter, der Kreis wird beim Kompilieren aufgelöst. */
import type { JClass } from './interpreter'

/* ==================================================================== *
 *  Laufzeitwerte und Java-genaue Arithmetik
 *
 *  Wichtig für die Klausur: int-Division schneidet ab, int läuft bei
 *  2^31 über, char rechnet als Zahl, und `double` wird von Java anders
 *  ausgegeben als von JavaScript (2.0 statt 2).
 * ==================================================================== */

export type PrimKind = 'int' | 'long' | 'double' | 'float' | 'char' | 'boolean' | 'byte' | 'short'

export type RuntimeClass = JClass

export type Val =
  | { k: 'int'; v: number }
  | { k: 'short'; v: number }
  | { k: 'byte'; v: number }
  | { k: 'char'; v: number }
  | { k: 'long'; v: bigint }
  | { k: 'double'; v: number }
  | { k: 'float'; v: number }
  | { k: 'boolean'; v: boolean }
  | { k: 'null' }
  /**
   * String. `id` fehlt bei internierten Zeichenketten (Literale und
   * konstante Ausdrücke) — die sind in Java identisch. Zur Laufzeit
   * erzeugte Strings (new String, Verkettung, substring …) bekommen eine
   * eigene Identität, damit `==` genau wie in der JVM antwortet.
   */
  | { k: 'str'; v: string; id?: number }
  | { k: 'arr'; elem: TypeRef; v: Val[] }
  | { k: 'obj'; cls: JClass; fields: Map<string, Val> }
  | { k: 'nat'; tag: string; v: unknown }
  | { k: 'clsref'; cls: JClass }
  | { k: 'fn'; params: string[]; body: unknown; env: unknown; thisVal: Val | null }

export const NULL: Val = { k: 'null' }
export const TRUE: Val = { k: 'boolean', v: true }
export const FALSE: Val = { k: 'boolean', v: false }

export const jint = (v: number): Val => ({ k: 'int', v: v | 0 })
export const jlong = (v: bigint): Val => ({ k: 'long', v: BigInt.asIntN(64, v) })
export const jdouble = (v: number): Val => ({ k: 'double', v })
export const jfloat = (v: number): Val => ({ k: 'float', v: Math.fround(v) })
export const jchar = (v: number): Val => ({ k: 'char', v: v & 0xffff })
export const jbool = (v: boolean): Val => (v ? TRUE : FALSE)
/** Interniertes String-Literal — gleiche Zeichen bedeuten dasselbe Objekt. */
export const jstr = (v: string): Val => ({ k: 'str', v })

let strSeq = 0
/** Zur Laufzeit erzeugter String — ein eigenes Objekt, `==` ist damit false. */
export const jstrNew = (v: string): Val => ({ k: 'str', v, id: ++strSeq })

export class JavaRuntimeError extends Error {
  constructor(
    readonly javaType: string,
    readonly detail: string,
    readonly line?: number,
  ) {
    super(detail ? `${javaType}: ${detail}` : javaType)
    this.name = 'JavaRuntimeError'
  }
}

/** Vom Programm geworfene Ausnahme (auch benutzerdefiniert). */
export class ThrownException extends Error {
  constructor(readonly value: Val, readonly typeName: string, readonly detail: string) {
    super(detail ? `${typeName}: ${detail}` : typeName)
    this.name = 'ThrownException'
  }
}

const NUMERIC = new Set<string>(['int', 'long', 'double', 'float', 'char', 'byte', 'short'])
export const isNumeric = (v: Val) => NUMERIC.has(v.k)

export function isIntegral(v: Val): boolean {
  return v.k === 'int' || v.k === 'long' || v.k === 'char' || v.k === 'byte' || v.k === 'short'
}

/* ----------------------- Ausgabe von Gleitkommazahlen ----------------------- */

function shortestDigits(a: number): { digits: string; exp: number } {
  const s = a.toExponential()
  const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s)
  if (!m) return { digits: '0', exp: 0 }
  return { digits: m[1] + (m[2] ?? ''), exp: parseInt(m[3], 10) }
}

function formatJavaFloating(d: number, digits: string, exp: number): string {
  const a = Math.abs(d)
  let out: string
  if (a >= 1e-3 && a < 1e7) {
    if (exp >= 0) {
      const intPart = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits.padEnd(exp + 1, '0')
      const frac = digits.slice(exp + 1)
      out = `${intPart}.${frac || '0'}`
    } else {
      out = `0.${'0'.repeat(-exp - 1)}${digits}`
    }
  } else {
    const frac = digits.slice(1)
    out = `${digits[0]}.${frac || '0'}E${exp}`
  }
  return d < 0 ? `-${out}` : out
}

/** Entspricht Java `Double.toString(d)` — inklusive „2.0" und „1.0E7". */
export function javaDoubleToString(d: number): string {
  if (Number.isNaN(d)) return 'NaN'
  if (d === Infinity) return 'Infinity'
  if (d === -Infinity) return '-Infinity'
  if (d === 0) return Object.is(d, -0) ? '-0.0' : '0.0'
  const { digits, exp } = shortestDigits(Math.abs(d))
  return formatJavaFloating(d, digits, exp)
}

/** Entspricht Java `Float.toString(f)` — kürzeste Darstellung in float-Genauigkeit. */
export function javaFloatToString(f: number): string {
  if (Number.isNaN(f)) return 'NaN'
  if (f === Infinity) return 'Infinity'
  if (f === -Infinity) return '-Infinity'
  if (f === 0) return Object.is(f, -0) ? '-0.0' : '0.0'
  const a = Math.abs(f)
  let digits = ''
  let exp = 0
  for (let prec = 1; prec <= 9; prec++) {
    const s = a.toExponential(prec - 1)
    if (Math.fround(Number(s)) === a) {
      const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(s)!
      digits = (m[1] + (m[2] ?? '')).replace(/0+$/, '') || '0'
      exp = parseInt(m[3], 10)
      break
    }
  }
  if (!digits) {
    const r = shortestDigits(a)
    digits = r.digits
    exp = r.exp
  }
  return formatJavaFloating(f, digits, exp)
}

/* --------------------------- Numerische Promotion --------------------------- */

export type NumKind = 'int' | 'long' | 'float' | 'double'

export function promoteKind(a: Val, b: Val): NumKind {
  if (a.k === 'double' || b.k === 'double') return 'double'
  if (a.k === 'float' || b.k === 'float') return 'float'
  if (a.k === 'long' || b.k === 'long') return 'long'
  return 'int'
}

export function asNumber(v: Val): number {
  switch (v.k) {
    case 'int': case 'short': case 'byte': case 'char': case 'double': case 'float':
      return v.v
    case 'long':
      return Number(v.v)
    case 'boolean':
      throw new JavaRuntimeError('IncompatibleTypes', 'Ein boolean kann nicht als Zahl verwendet werden.')
    default:
      throw new JavaRuntimeError('IncompatibleTypes', `Der Wert ist keine Zahl (${describeKind(v)}).`)
  }
}

export function asBigInt(v: Val): bigint {
  if (v.k === 'long') return v.v
  if (v.k === 'int' || v.k === 'short' || v.k === 'byte' || v.k === 'char') return BigInt(v.v)
  if (v.k === 'double' || v.k === 'float') return BigInt(Math.trunc(v.v))
  throw new JavaRuntimeError('IncompatibleTypes', 'Der Wert ist keine ganze Zahl.')
}

export function asBoolean(v: Val): boolean {
  if (v.k === 'boolean') return v.v
  if (v.k === 'nat' && v.tag === 'Boolean') return v.v as boolean
  if (v.k === 'null') throw new JavaRuntimeError('NullPointerException', 'Es wurde ein boolean erwartet, der Wert ist aber null.')
  throw new JavaRuntimeError(
    'IncompatibleTypes',
    `Hier wird ein boolean erwartet (${describeKind(v)}). In Java ist eine Zahl kein Wahrheitswert — schreibe z. B. «x != 0».`,
  )
}

export function describeKind(v: Val): string {
  switch (v.k) {
    case 'str': return 'String'
    case 'arr': return 'Array'
    case 'obj': return v.cls.name
    case 'null': return 'null'
    case 'nat': return v.tag
    case 'clsref': return `Klasse ${v.cls.name}`
    case 'fn': return 'Lambda'
    default: return v.k
  }
}

/* ------------------------------ Arithmetik ------------------------------ */

function intDiv(a: number, b: number): number {
  if (b === 0) {
    throw new JavaRuntimeError('ArithmeticException', '/ by zero')
  }
  return Math.trunc(a / b) | 0
}

export function arith(op: string, a: Val, b: Val): Val {
  const kind = promoteKind(a, b)

  if (kind === 'double' || kind === 'float') {
    const x = asNumber(a)
    const y = asNumber(b)
    let r: number
    switch (op) {
      case '+': r = x + y; break
      case '-': r = x - y; break
      case '*': r = x * y; break
      case '/': r = x / y; break
      case '%': r = x % y; break
      default: throw new JavaRuntimeError('IncompatibleTypes', `Der Operator ${op} ist für Gleitkommazahlen nicht definiert.`)
    }
    return kind === 'float' ? jfloat(r) : jdouble(r)
  }

  if (kind === 'long') {
    const x = asBigInt(a)
    const y = asBigInt(b)
    let r: bigint
    switch (op) {
      case '+': r = x + y; break
      case '-': r = x - y; break
      case '*': r = x * y; break
      case '/':
        if (y === 0n) throw new JavaRuntimeError('ArithmeticException', '/ by zero')
        r = x / y
        break
      case '%':
        if (y === 0n) throw new JavaRuntimeError('ArithmeticException', '/ by zero')
        r = x % y
        break
      default: throw new JavaRuntimeError('IncompatibleTypes', `Der Operator ${op} ist hier nicht definiert.`)
    }
    return jlong(r)
  }

  const x = asNumber(a) | 0
  const y = asNumber(b) | 0
  switch (op) {
    case '+': return jint((x + y) | 0)
    case '-': return jint((x - y) | 0)
    case '*': return jint(Math.imul(x, y))
    case '/': return jint(intDiv(x, y))
    case '%':
      if (y === 0) throw new JavaRuntimeError('ArithmeticException', '/ by zero')
      return jint(x % y)
    default: throw new JavaRuntimeError('IncompatibleTypes', `Der Operator ${op} ist hier nicht definiert.`)
  }
}

export function bitwise(op: string, a: Val, b: Val): Val {
  if (a.k === 'boolean' || b.k === 'boolean') {
    const x = asBoolean(a)
    const y = asBoolean(b)
    switch (op) {
      case '&': return jbool(x && y)
      case '|': return jbool(x || y)
      case '^': return jbool(x !== y)
    }
  }
  const kind = promoteKind(a, b)
  if (kind === 'long') {
    const x = asBigInt(a)
    const y = asBigInt(b)
    switch (op) {
      case '&': return jlong(x & y)
      case '|': return jlong(x | y)
      case '^': return jlong(x ^ y)
    }
  }
  const x = asNumber(a) | 0
  const y = asNumber(b) | 0
  switch (op) {
    case '&': return jint(x & y)
    case '|': return jint(x | y)
    case '^': return jint(x ^ y)
  }
  throw new JavaRuntimeError('IncompatibleTypes', `Unbekannter Bit-Operator ${op}.`)
}

export function shift(op: string, a: Val, b: Val): Val {
  if (a.k === 'long') {
    const x = asBigInt(a)
    const s = BigInt(Number(asBigInt(b)) & 63)
    switch (op) {
      case '<<': return jlong(x << s)
      case '>>': return jlong(x >> s)
      case '>>>': return jlong(BigInt.asIntN(64, BigInt.asUintN(64, x) >> s))
    }
  }
  const x = asNumber(a) | 0
  const s = asNumber(b) & 31
  switch (op) {
    case '<<': return jint(x << s)
    case '>>': return jint(x >> s)
    case '>>>': return jint(x >>> s | 0)
  }
  throw new JavaRuntimeError('IncompatibleTypes', `Unbekannter Shift-Operator ${op}.`)
}

export function compare(op: string, a: Val, b: Val): boolean {
  const kind = promoteKind(a, b)
  if (kind === 'long') {
    const x = asBigInt(a)
    const y = asBigInt(b)
    switch (op) {
      case '<': return x < y
      case '>': return x > y
      case '<=': return x <= y
      case '>=': return x >= y
    }
  }
  const x = asNumber(a)
  const y = asNumber(b)
  switch (op) {
    case '<': return x < y
    case '>': return x > y
    case '<=': return x <= y
    case '>=': return x >= y
  }
  throw new JavaRuntimeError('IncompatibleTypes', `Unbekannter Vergleichsoperator ${op}.`)
}

/** `==` in Java: Werte bei Primitiven, Referenzen bei Objekten. */
export function refEquals(a: Val, b: Val): boolean {
  if (a.k === 'null' || b.k === 'null') return a.k === 'null' && b.k === 'null'
  if (a.k === 'boolean' || b.k === 'boolean') {
    if (a.k === 'boolean' && b.k === 'boolean') return a.v === b.v
    return false
  }
  if (isNumeric(a) && isNumeric(b)) {
    const kind = promoteKind(a, b)
    if (kind === 'long') return asBigInt(a) === asBigInt(b)
    return asNumber(a) === asNumber(b)
  }
  if (a.k === 'str' && b.k === 'str') {
    /* Literale liegen im String-Pool und sind identisch; zur Laufzeit
       erzeugte Strings sind eigene Objekte — `==` vergleicht Referenzen. */
    if (a.id === undefined && b.id === undefined) return a.v === b.v
    return a.id === b.id
  }
  return a === b
}

/* --------------------------- Typumwandlungen --------------------------- */

export function castPrimitive(target: PrimKind, v: Val): Val {
  switch (target) {
    case 'int': {
      if (v.k === 'long') return jint(Number(BigInt.asIntN(32, v.v)))
      const n = asNumber(v)
      if (!Number.isFinite(n)) return jint(n > 0 ? 2147483647 : n < 0 ? -2147483648 : 0)
      return jint(Math.trunc(n) | 0)
    }
    case 'long':
      if (v.k === 'double' || v.k === 'float') {
        if (!Number.isFinite(v.v)) return jlong(v.v > 0 ? 9223372036854775807n : -9223372036854775808n)
        return jlong(BigInt(Math.trunc(v.v)))
      }
      return jlong(asBigInt(v))
    case 'double':
      return jdouble(v.k === 'long' ? Number(v.v) : asNumber(v))
    case 'float':
      return jfloat(v.k === 'long' ? Number(v.v) : asNumber(v))
    case 'char': {
      const n = v.k === 'long' ? Number(BigInt.asIntN(32, v.v)) : Math.trunc(asNumber(v))
      return jchar(n & 0xffff)
    }
    case 'byte': {
      const n = v.k === 'long' ? Number(BigInt.asIntN(32, v.v)) : Math.trunc(asNumber(v))
      return { k: 'byte', v: (n << 24) >> 24 }
    }
    case 'short': {
      const n = v.k === 'long' ? Number(BigInt.asIntN(32, v.v)) : Math.trunc(asNumber(v))
      return { k: 'short', v: (n << 16) >> 16 }
    }
    case 'boolean':
      return jbool(asBoolean(v))
  }
}

/** Implizite Anpassung bei Zuweisung an eine deklarierte Variable. */
export function coerceToDeclared(type: TypeRef, v: Val): Val {
  if (type.dims > 0) return v
  switch (type.name) {
    case 'int': case 'long': case 'double': case 'float': case 'char':
    case 'byte': case 'short': case 'boolean':
      if (v.k === 'null') {
        throw new JavaRuntimeError('IncompatibleTypes', `Ein ${type.name} kann nicht null sein.`)
      }
      if (v.k === 'nat' && (v.tag === 'Integer' || v.tag === 'Double' || v.tag === 'Boolean' || v.tag === 'Character' || v.tag === 'Long')) {
        return coerceToDeclared(type, unbox(v))
      }
      return castPrimitive(type.name as PrimKind, v)
    case 'Integer':
      return v.k === 'null' ? v : jint(asNumber(v) | 0)
    case 'Long':
      return v.k === 'null' ? v : jlong(asBigInt(v))
    case 'Double':
      return v.k === 'null' ? v : jdouble(asNumber(v))
    case 'Float':
      return v.k === 'null' ? v : jfloat(asNumber(v))
    case 'Character':
      return v.k === 'null' ? v : jchar(asNumber(v))
    case 'Boolean':
      return v.k === 'null' ? v : jbool(asBoolean(v))
    case 'String':
      return v
    default:
      return v
  }
}

export function unbox(v: Val): Val {
  if (v.k === 'nat' && ['Integer', 'Double', 'Long', 'Character', 'Boolean', 'Float'].includes(v.tag)) {
    return v.v as Val
  }
  return v
}

/** Standardwert eines Feldes/Array-Elements. */
export function defaultValue(type: TypeRef): Val {
  if (type.dims > 0) return NULL
  switch (type.name) {
    case 'int': return jint(0)
    case 'short': return { k: 'short', v: 0 }
    case 'byte': return { k: 'byte', v: 0 }
    case 'long': return jlong(0n)
    case 'double': return jdouble(0)
    case 'float': return jfloat(0)
    case 'char': return jchar(0)
    case 'boolean': return FALSE
    default: return NULL
  }
}
