import type {
  ArrayInit, Block, ClassDecl, CompilationUnit, Expr, FieldDecl, InitBlock, MethodDecl,
  Param, Stmt, TypeRef,
} from './ast'
import {
  BUILTIN_EXCEPTIONS, STATIC_CLASSES, constructNative, iterableToArray, javaFormat,
  nativeMethod, staticField, staticMethod, stringMethod, hashOf, type NativeCtx,
} from './natives'
import {
  FALSE, JavaRuntimeError, NULL, ThrownException, TRUE, arith, asBoolean, asNumber, asBigInt,
  bitwise, castPrimitive, coerceToDeclared, compare, defaultValue, describeKind, isNumeric,
  javaDoubleToString, javaFloatToString, jbool, jchar, jdouble, jfloat, jint, jlong, jstr, jstrNew,
  refEquals, shift, unbox, type PrimKind, type Val,
} from './values'

/* ==================================================================== *
 *  Java-Interpreter
 *
 *  Führt den geparsten Syntaxbaum aus. Semantik so nah wie möglich an
 *  der echten JVM: int-Überlauf, abschneidende Division, statische
 *  Typen bei der Ausgabe, dynamische Bindung bei Methoden.
 * ==================================================================== */

const PRIMITIVE_NAMES = new Set(['int', 'long', 'double', 'float', 'char', 'boolean', 'byte', 'short'])

const WIDENING: Record<string, string[]> = {
  byte: ['byte', 'short', 'int', 'long', 'float', 'double'],
  short: ['short', 'int', 'long', 'float', 'double'],
  char: ['char', 'int', 'long', 'float', 'double'],
  int: ['int', 'long', 'float', 'double'],
  long: ['long', 'float', 'double'],
  float: ['float', 'double'],
  double: ['double'],
  boolean: ['boolean'],
}

export interface FieldInfo {
  name: string
  type: TypeRef
  init?: Expr | ArrayInit
  isStatic: boolean
  isFinal: boolean
  owner: JClass
}

export interface JClass {
  name: string
  decl: ClassDecl
  superclass: JClass | null
  /** Name einer eingebauten Oberklasse (z. B. Exception) */
  builtinSuper: string | null
  interfaces: string[]
  isInterface: boolean
  isAbstract: boolean
  allNames: Set<string>
  fields: FieldInfo[]
  staticValues: Map<string, Val>
  methods: Map<string, MethodDecl[]>
  ctors: MethodDecl[]
  instanceInit: InitBlock[]
  staticInit: InitBlock[]
  staticDone: boolean
  enumConstants: Map<string, Val>
}

class Env {
  private vars = new Map<string, { v: Val; type: TypeRef }>()
  constructor(readonly parent: Env | null) {}

  declare(name: string, type: TypeRef, v: Val) {
    this.vars.set(name, { v, type })
  }
  lookup(name: string): { v: Val; type: TypeRef } | undefined {
    let e: Env | null = this
    while (e) {
      const hit = e.vars.get(name)
      if (hit) return hit
      e = e.parent
    }
    return undefined
  }
  assign(name: string, v: Val): boolean {
    let e: Env | null = this
    while (e) {
      const hit = e.vars.get(name)
      if (hit) {
        hit.v = coerceToDeclared(hit.type, v)
        return true
      }
      e = e.parent
    }
    return false
  }
}

class BreakSignal {
  constructor(readonly label?: string) {}
}
class ContinueSignal {
  constructor(readonly label?: string) {}
}
class ReturnSignal {
  constructor(readonly value: Val) {}
}
class ExitSignal {
  constructor(readonly code: number) {}
}

export interface RunOptions {
  stdin?: string
  /** Obergrenze für ausgeführte Schritte (Schutz vor Endlosschleifen) */
  maxSteps?: number
  maxMillis?: number
  maxOutput?: number
  mainClass?: string
  args?: string[]
}

export interface RunResult {
  stdout: string
  stderr: string
  /** Ausnahme, die das Programm beendet hat */
  exception?: { type: string; message: string; line?: number }
  exitCode: number
  steps: number
  durationMs: number
  timedOut: boolean
}

export class Interpreter implements NativeCtx {
  private classes = new Map<string, JClass>()
  private out: string[] = []
  private err: string[] = []
  private outLen = 0
  private steps = 0
  private depth = 0
  private deadline = 0
  private stdinLines: string[] = []
  private stdinPos = 0
  private tokenBuf: string[] = []
  private identity = new WeakMap<object, number>()
  private identitySeq = 1
  /** aktuelle Zeile für Fehlermeldungen */
  private line = 0

  private maxSteps: number
  private maxMillis: number
  private maxOutput: number

  constructor(
    private unit: CompilationUnit,
    private opts: RunOptions = {},
  ) {
    this.maxSteps = opts.maxSteps ?? 40_000_000
    this.maxMillis = opts.maxMillis ?? 6000
    this.maxOutput = opts.maxOutput ?? 200_000
    const raw = opts.stdin ?? ''
    this.stdinLines = raw.length ? raw.replace(/\r\n?/g, '\n').split('\n') : []
    if (this.stdinLines.length && this.stdinLines[this.stdinLines.length - 1] === '') this.stdinLines.pop()
  }

  /* ----------------------------- Aufbau ----------------------------- */

  private register(decl: ClassDecl) {
    const cls: JClass = {
      name: decl.name,
      decl,
      superclass: null,
      builtinSuper: null,
      interfaces: decl.implements.map((t) => t.name),
      isInterface: decl.type === 'interface',
      isAbstract: decl.modifiers.includes('abstract') || decl.type === 'interface',
      allNames: new Set([decl.name]),
      fields: [],
      staticValues: new Map(),
      methods: new Map(),
      ctors: [],
      instanceInit: [],
      staticInit: [],
      staticDone: false,
      enumConstants: new Map(),
    }
    this.classes.set(decl.name, cls)
    for (const m of decl.members) if (m.kind === 'class') this.register(m)
  }

  private link(cls: JClass) {
    const decl = cls.decl
    if (decl.extends) {
      const sup = this.classes.get(decl.extends.name)
      if (sup) cls.superclass = sup
      else if (BUILTIN_EXCEPTIONS[decl.extends.name]) cls.builtinSuper = decl.extends.name
      else if (decl.extends.name !== 'Object') cls.builtinSuper = decl.extends.name
    }
    if (decl.type === 'enum') cls.builtinSuper = cls.builtinSuper ?? 'Enum'

    // Namensmenge für instanceof / catch
    const collect = (c: JClass) => {
      cls.allNames.add(c.name)
      for (const i of c.interfaces) {
        cls.allNames.add(i)
        const ic = this.classes.get(i)
        if (ic) collect(ic)
      }
      if (c.superclass) collect(c.superclass)
      else if (c.builtinSuper) {
        cls.allNames.add(c.builtinSuper)
        for (const anc of BUILTIN_EXCEPTIONS[c.builtinSuper] ?? []) cls.allNames.add(anc)
      }
    }
    collect(cls)
    cls.allNames.add('Object')

    for (const m of decl.members) {
      if (m.kind === 'field') {
        const f = m as FieldDecl
        for (const v of f.vars) {
          cls.fields.push({
            name: v.name,
            type: { ...f.type, dims: f.type.dims + v.extraDims },
            init: v.init,
            isStatic: f.modifiers.includes('static') || cls.isInterface,
            isFinal: f.modifiers.includes('final'),
            owner: cls,
          })
        }
      } else if (m.kind === 'method') {
        const mm = m as MethodDecl
        if (mm.isConstructor) cls.ctors.push(mm)
        else {
          const list = cls.methods.get(mm.name) ?? []
          list.push(mm)
          cls.methods.set(mm.name, list)
        }
      } else if (m.kind === 'init') {
        if ((m as InitBlock).static) cls.staticInit.push(m as InitBlock)
        else cls.instanceInit.push(m as InitBlock)
      }
    }

    /* Records: Komponenten als finale Felder + Accessoren */
    if (decl.type === 'record' && decl.recordComponents) {
      for (const rc of decl.recordComponents) {
        cls.fields.push({ name: rc.name, type: rc.type, isStatic: false, isFinal: true, owner: cls })
      }
    }
  }

  private ensureStatic(cls: JClass) {
    if (cls.staticDone) return
    cls.staticDone = true
    for (const f of cls.fields) {
      if (f.isStatic) cls.staticValues.set(f.name, defaultValue(f.type))
    }
    /* Enum-Konstanten */
    if (cls.decl.type === 'enum' && cls.decl.enumConstants) {
      cls.decl.enumConstants.forEach((ec, index) => {
        const obj: Val & { k: 'obj' } = { k: 'obj', cls, fields: new Map<string, Val>() }
        this.initFields(obj, cls)
        obj.fields.set('$name', jstr(ec.name))
        obj.fields.set('$ordinal', jint(index))
        const env = new Env(null)
        const args = ec.args.map((a) => this.eval(a, env, null, cls))
        this.construct(cls, obj, args, env)
        cls.enumConstants.set(ec.name, obj)
        cls.staticValues.set(ec.name, obj)
      })
    }
    const env = new Env(null)
    for (const f of cls.fields) {
      if (f.isStatic && f.init) {
        cls.staticValues.set(f.name, coerceToDeclared(f.type, this.evalInit(f.init, f.type, env, null, cls)))
      }
    }
    for (const b of cls.staticInit) this.execBlock(b.body, new Env(env), null, cls)
  }

  /* ------------------------------ Start ------------------------------ */

  /** Klassen registrieren und verknüpfen — ohne etwas auszuführen. */
  prepare() {
    for (const t of this.unit.types) this.register(t)
    for (const c of this.classes.values()) this.link(c)
  }

  /** Wertet einen einzelnen Java-Ausdruck im statischen Kontext einer Klasse aus (für Aufgabentests). */
  evalExpressionSource(src: string, parse: (s: string) => Expr, className?: string): Val {
    this.deadline = Date.now() + this.maxMillis
    const cls = (className && this.classes.get(className)) || this.findMainClass() || [...this.classes.values()][0] || null
    if (cls) this.ensureStatic(cls)
    return this.eval(parse(src), new Env(null), null, cls)
  }

  get classList(): JClass[] {
    return [...this.classes.values()]
  }

  run(): RunResult {
    const started = Date.now()
    this.deadline = started + this.maxMillis
    let exception: RunResult['exception']
    let exitCode = 0
    let timedOut = false

    try {
      this.prepare()

      const mainCls = this.findMainClass()
      if (!mainCls) {
        throw new JavaRuntimeError(
          'NoMainMethod',
          'Es gibt keine main-Methode. Ein ausführbares Java-Programm braucht:\n' +
            '    public static void main(String[] args) { … }',
        )
      }
      this.ensureStatic(mainCls)
      const main = (mainCls.methods.get('main') ?? []).find((m) => m.modifiers.includes('static'))!
      const argv: Val = {
        k: 'arr',
        elem: { name: 'String', dims: 0 },
        v: (this.opts.args ?? []).map(jstr),
      }
      this.invoke(main, null, mainCls, main.params.length ? [argv] : [])
    } catch (e) {
      if (e instanceof ExitSignal) {
        exitCode = e.code
      } else if (e instanceof ThrownException) {
        exception = { type: e.typeName, message: e.detail, line: this.line }
        exitCode = 1
        this.err.push(`Exception in thread "main" ${e.typeName}${e.detail ? ': ' + e.detail : ''}\n`)
      } else if (e instanceof JavaRuntimeError) {
        if (e.javaType === 'Timeout' || e.javaType === 'StepLimit') timedOut = true
        exception = { type: e.javaType, message: e.detail, line: this.line }
        exitCode = 1
        this.err.push(
          e.javaType === 'Timeout' || e.javaType === 'StepLimit' || e.javaType === 'OutputLimit' || e.javaType === 'NoMainMethod'
            ? `${e.detail}\n`
            : `Exception in thread "main" ${e.javaType}${e.detail ? ': ' + e.detail : ''}\n`,
        )
      } else {
        exception = { type: 'InternalError', message: (e as Error).message, line: this.line }
        exitCode = 1
        this.err.push(`Interner Fehler: ${(e as Error).message}\n`)
      }
    }

    return {
      stdout: this.out.join(''),
      stderr: this.err.join(''),
      exception,
      exitCode,
      steps: this.steps,
      durationMs: Date.now() - started,
      timedOut,
    }
  }

  private findMainClass(): JClass | null {
    const wanted = this.opts.mainClass
    if (wanted && this.classes.has(wanted)) return this.classes.get(wanted)!
    for (const t of this.unit.types) {
      const c = this.classes.get(t.name)!
      const mains = c.methods.get('main') ?? []
      if (mains.some((m) => m.modifiers.includes('static'))) return c
    }
    for (const c of this.classes.values()) {
      const mains = c.methods.get('main') ?? []
      if (mains.some((m) => m.modifiers.includes('static'))) return c
    }
    return null
  }

  /* --------------------------- NativeCtx --------------------------- */

  print(text: string, toErr = false) {
    this.outLen += text.length
    if (this.outLen > this.maxOutput) {
      throw new JavaRuntimeError(
        'OutputLimit',
        `Das Programm hat mehr als ${Math.round(this.maxOutput / 1000)} 000 Zeichen ausgegeben und wurde gestoppt. Läuft eine Schleife endlos?`,
      )
    }
    ;(toErr ? this.err : this.out).push(text)
  }

  exit(code: number): never {
    throw new ExitSignal(code)
  }

  readLine(): string | null {
    if (this.tokenBuf.length) {
      const rest = this.tokenBuf.join(' ')
      this.tokenBuf = []
      return rest
    }
    if (this.stdinPos >= this.stdinLines.length) return null
    return this.stdinLines[this.stdinPos++]
  }

  readToken(): string | null {
    for (;;) {
      if (this.tokenBuf.length) return this.tokenBuf.shift()!
      if (this.stdinPos >= this.stdinLines.length) return null
      const line = this.stdinLines[this.stdinPos++]
      this.tokenBuf = line.split(/\s+/).filter(Boolean)
    }
  }

  hasMoreInput(kind: 'line' | 'token' | 'int'): boolean {
    if (kind === 'line') return this.tokenBuf.length > 0 || this.stdinPos < this.stdinLines.length
    let i = this.stdinPos
    let buf = this.tokenBuf
    while (!buf.length && i < this.stdinLines.length) buf = this.stdinLines[i++].split(/\s+/).filter(Boolean)
    if (!buf.length) return false
    return kind === 'token' || /^[+-]?\d+$/.test(buf[0])
  }

  callFunctional(fn: Val, args: Val[]): Val {
    if (fn.k === 'fn') {
      const env = new Env(fn.env as Env)
      fn.params.forEach((p, i) => env.declare(p, { name: 'var', dims: 0 }, args[i] ?? NULL))
      const body = fn.body as Expr | Block
      if ((body as Block).kind === 'block') {
        try {
          this.execBlock(body as Block, env, fn.thisVal, null)
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value
          throw e
        }
        return NULL
      }
      return this.eval(body as Expr, env, fn.thisVal, null)
    }
    if (fn.k === 'obj') {
      // funktionales Interface als anonyme Klasse
      for (const [, list] of fn.cls.methods) {
        const m = list.find((x) => x.params.length === args.length && x.body)
        if (m) return this.invoke(m, fn, fn.cls, args)
      }
    }
    throw new JavaRuntimeError('IncompatibleTypes', 'Hier wird eine Funktion (Lambda) erwartet.')
  }

  valueEquals(a: Val, b: Val): boolean {
    const ua = unbox(a)
    const ub = unbox(b)
    if (ua.k === 'null' || ub.k === 'null') return ua.k === 'null' && ub.k === 'null'
    if (ua.k === 'str' && ub.k === 'str') return ua.v === ub.v
    if (isNumeric(ua) && isNumeric(ub)) return asNumber(ua) === asNumber(ub) && (ua.k === ub.k || true)
    if (ua.k === 'boolean' && ub.k === 'boolean') return ua.v === ub.v
    if (ua.k === 'obj') {
      const eq = this.findMethod(ua.cls, 'equals', [ub])
      if (eq) return asBoolean(this.invoke(eq.m, ua, eq.cls, [ub]))
      return ua === ub
    }
    if (ua.k === 'arr' && ub.k === 'arr') return ua === ub
    if (ua.k === 'nat' && ub.k === 'nat') {
      if (ua.tag !== ub.tag) return false
      return this.str(ua) === this.str(ub)
    }
    return ua === ub
  }

  compareValues(a: Val, b: Val): number {
    const ua = unbox(a)
    const ub = unbox(b)
    if (ua.k === 'str' && ub.k === 'str') return ua.v < ub.v ? -1 : ua.v > ub.v ? 1 : 0
    if (isNumeric(ua) && isNumeric(ub)) {
      const x = ua.k === 'long' ? asBigInt(ua) : asNumber(ua)
      const y = ub.k === 'long' ? asBigInt(ub) : asNumber(ub)
      const xn = typeof x === 'bigint' ? Number(x) : x
      const yn = typeof y === 'bigint' ? Number(y) : y
      return xn < yn ? -1 : xn > yn ? 1 : 0
    }
    if (ua.k === 'boolean' && ub.k === 'boolean') return Number(ua.v) - Number(ub.v)
    if (ua.k === 'obj') {
      const m = this.findMethod(ua.cls, 'compareTo', [ub])
      if (m) return Math.trunc(asNumber(this.invoke(m.m, ua, m.cls, [ub])))
    }
    const sa = this.str(ua)
    const sb = this.str(ub)
    return sa < sb ? -1 : sa > sb ? 1 : 0
  }

  /** Java `String.valueOf(v)` */
  str(v: Val): string {
    switch (v.k) {
      case 'null': return 'null'
      case 'str': return v.v
      case 'boolean': return v.v ? 'true' : 'false'
      case 'char': return String.fromCharCode(v.v)
      case 'int': case 'short': case 'byte': return String(v.v)
      case 'long': return v.v.toString()
      case 'double': return javaDoubleToString(v.v)
      case 'float': return javaFloatToString(v.v)
      case 'arr': return `${arrayTag(v.elem)}@${this.idHex(v)}`
      case 'clsref': return `class ${v.cls.name}`
      case 'fn': return `$$Lambda@${this.idHex(v)}`
      case 'obj': {
        if (v.cls.decl.type === 'enum') {
          const nm = v.fields.get('$name')
          const custom = this.findMethod(v.cls, 'toString', [])
          if (custom) return this.str(this.invoke(custom.m, v, custom.cls, []))
          return nm && nm.k === 'str' ? nm.v : v.cls.name
        }
        const m = this.findMethod(v.cls, 'toString', [])
        if (m) return this.str(this.invoke(m.m, v, m.cls, []))
        if (v.cls.decl.type === 'record') {
          const parts = (v.cls.decl.recordComponents ?? []).map(
            (rc) => `${rc.name}=${this.str(v.fields.get(fieldKey(v.cls, rc.name)) ?? NULL)}`,
          )
          return `${v.cls.name}[${parts.join(', ')}]`
        }
        if (this.isThrowableClass(v.cls)) {
          const msg = v.fields.get('__message')
          return msg && msg.k === 'str' ? `${v.cls.name}: ${msg.v}` : v.cls.name
        }
        return `${v.cls.name}@${this.idHex(v)}`
      }
      case 'nat': {
        switch (v.tag) {
          case 'StringBuilder': return (v.v as { s: string }).s
          case 'Integer': case 'Double': case 'Long': case 'Character': case 'Boolean': case 'Float':
            return this.str(unbox(v))
          case 'ArrayList': case 'HashMap': case 'HashSet': case 'KeySet': case 'Values': case 'EntrySet': case 'MapEntry':
            return this.str(nativeMethod(v, 'toString', [], this))
          case 'Throwable': {
            const t = v.v as { type: string; message: string }
            return t.message ? `${t.type}: ${t.message}` : t.type
          }
          case 'Class': return String(v.v)
          case 'StaticClass': return `class ${String(v.v)}`
          default: return `${v.tag}@${this.idHex(v)}`
        }
      }
    }
  }

  private idHex(o: object): string {
    let id = this.identity.get(o)
    if (!id) {
      id = (this.identitySeq = (this.identitySeq * 1103515245 + 12345) >>> 8) >>> 0
      this.identity.set(o, id)
    }
    return id.toString(16)
  }

  private isThrowableClass(cls: JClass): boolean {
    return cls.allNames.has('Throwable') || cls.allNames.has('Exception') || cls.allNames.has('RuntimeException') || cls.allNames.has('Error')
  }

  /* ----------------------------- Takte ----------------------------- */

  private tick() {
    if ((++this.steps & 0x3fff) === 0) {
      if (Date.now() > this.deadline) {
        throw new JavaRuntimeError(
          'Timeout',
          'Zeitüberschreitung: Das Programm lief zu lange und wurde gestoppt. Typische Ursache ist eine Schleife, deren Bedingung nie falsch wird.',
        )
      }
    }
    if (this.steps > this.maxSteps) {
      throw new JavaRuntimeError('StepLimit', 'Das Programm hat zu viele Schritte ausgeführt und wurde gestoppt (Endlosschleife?).')
    }
  }

  /* --------------------------- Anweisungen --------------------------- */

  private execBlock(b: Block, env: Env, thisVal: Val | null, cls: JClass | null) {
    const inner = new Env(env)
    for (const s of b.stmts) this.exec(s, inner, thisVal, cls)
  }

  private exec(s: Stmt, env: Env, thisVal: Val | null, cls: JClass | null, label?: string): void {
    this.tick()
    this.line = s.line
    /** trifft ein break/continue diese Schleife? */
    const mine = (l?: string) => !l || l === label

    switch (s.kind) {
      case 'block':
        this.execBlock(s, env, thisVal, cls)
        return

      case 'empty':
        return

      case 'localvar': {
        for (const v of s.vars) {
          const type: TypeRef = { ...s.type, dims: s.type.dims + v.extraDims }
          let value: Val = defaultValue(type)
          if (v.init) value = coerceToDeclared(type, this.evalInit(v.init, type, env, thisVal, cls))
          env.declare(v.name, type.name === 'var' ? inferType(value) : type, value)
        }
        return
      }

      case 'exprstmt':
        this.eval(s.expr, env, thisVal, cls)
        return

      case 'if':
        if (asBoolean(this.eval(s.cond, env, thisVal, cls))) this.exec(s.then, env, thisVal, cls)
        else if (s.else) this.exec(s.else, env, thisVal, cls)
        return

      case 'while':
        for (;;) {
          this.tick()
          if (!asBoolean(this.eval(s.cond, env, thisVal, cls))) break
          try {
            this.exec(s.body, env, thisVal, cls)
          } catch (e) {
            if (e instanceof BreakSignal && mine(e.label)) break
            if (e instanceof ContinueSignal && mine(e.label)) continue
            throw e
          }
        }
        return

      case 'dowhile':
        for (;;) {
          this.tick()
          try {
            this.exec(s.body, env, thisVal, cls)
          } catch (e) {
            if (e instanceof BreakSignal && mine(e.label)) break
            if (!(e instanceof ContinueSignal && mine(e.label))) throw e
          }
          if (!asBoolean(this.eval(s.cond, env, thisVal, cls))) break
        }
        return

      case 'for': {
        const loopEnv = new Env(env)
        for (const init of s.init) this.exec(init, loopEnv, thisVal, cls)
        for (;;) {
          this.tick()
          if (s.cond && !asBoolean(this.eval(s.cond, loopEnv, thisVal, cls))) break
          try {
            this.exec(s.body, loopEnv, thisVal, cls)
          } catch (e) {
            if (e instanceof BreakSignal && mine(e.label)) break
            if (!(e instanceof ContinueSignal && mine(e.label))) throw e
          }
          for (const u of s.update) this.eval(u, loopEnv, thisVal, cls)
        }
        return
      }

      case 'foreach': {
        const iterable = this.eval(s.iterable, env, thisVal, cls)
        const items = iterableToArray(iterable, this)
        for (const item of items) {
          this.tick()
          const loopEnv = new Env(env)
          loopEnv.declare(s.varName, s.varType, s.varType.name === 'var' ? item : coerceToDeclared(s.varType, item))
          try {
            this.exec(s.body, loopEnv, thisVal, cls)
          } catch (e) {
            if (e instanceof BreakSignal && mine(e.label)) break
            if (!(e instanceof ContinueSignal && mine(e.label))) throw e
          }
        }
        return
      }

      case 'switch': {
        const subject = this.eval(s.subject, env, thisVal, cls)
        const swEnv = new Env(env)
        let start = -1
        for (let i = 0; i < s.cases.length; i++) {
          const c = s.cases[i]
          if (c.isDefault) continue
          for (const lab of c.labels) {
            const lv = this.evalCaseLabel(lab, subject, env, thisVal, cls)
            if (this.switchMatches(subject, lv)) {
              start = i
              break
            }
          }
          if (start >= 0) break
        }
        if (start < 0) start = s.cases.findIndex((c) => c.isDefault)
        if (start < 0) return
        try {
          if (s.cases[start].arrow) {
            for (const st of s.cases[start].stmts) this.exec(st, swEnv, thisVal, cls)
          } else {
            for (let i = start; i < s.cases.length; i++) {
              for (const st of s.cases[i].stmts) this.exec(st, swEnv, thisVal, cls)
            }
          }
        } catch (e) {
          if (e instanceof BreakSignal && !e.label) return
          throw e
        }
        return
      }

      case 'break':
        throw new BreakSignal(s.label)
      case 'continue':
        throw new ContinueSignal(s.label)
      case 'return':
        throw new ReturnSignal(s.value ? this.eval(s.value, env, thisVal, cls) : NULL)

      case 'throw': {
        const v = this.eval(s.value, env, thisVal, cls)
        throw this.toThrown(v)
      }

      case 'labeled':
        try {
          this.exec(s.body, env, thisVal, cls, s.label)
        } catch (e) {
          if (e instanceof BreakSignal && e.label === s.label) return
          if (e instanceof ContinueSignal && e.label === s.label) return
          throw e
        }
        return

      case 'try':
        this.execTry(s, env, thisVal, cls)
        return

      case 'localclass': {
        this.register(s.decl)
        this.link(this.classes.get(s.decl.name)!)
        return
      }

      case 'assert': {
        if (!asBoolean(this.eval(s.cond, env, thisVal, cls))) {
          const msg = s.message ? this.str(this.eval(s.message, env, thisVal, cls)) : ''
          throw new JavaRuntimeError('AssertionError', msg)
        }
        return
      }
    }
  }

  private evalCaseLabel(lab: Expr, subject: Val, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    // Enum-Konstanten dürfen in case unqualifiziert stehen
    if (lab.kind === 'name' && subject.k === 'obj' && subject.cls.decl.type === 'enum') {
      const ec = subject.cls.enumConstants.get(lab.name)
      if (ec) return ec
    }
    return this.eval(lab, env, thisVal, cls)
  }

  private switchMatches(subject: Val, label: Val): boolean {
    if (subject.k === 'str' || label.k === 'str') return this.str(subject) === this.str(label)
    if (subject.k === 'obj' || label.k === 'obj') return subject === label
    return refEquals(unbox(subject), unbox(label))
  }

  private execTry(s: Extract<Stmt, { kind: 'try' }>, env: Env, thisVal: Val | null, cls: JClass | null) {
    const tryEnv = new Env(env)
    for (const r of s.resources) this.exec(r, tryEnv, thisVal, cls)
    try {
      try {
        this.execBlock(s.body, tryEnv, thisVal, cls)
      } catch (e) {
        if (e instanceof BreakSignal || e instanceof ContinueSignal || e instanceof ReturnSignal || e instanceof ExitSignal) throw e
        const thrown = this.asCatchable(e)
        if (!thrown) throw e
        for (const c of s.catches) {
          if (c.types.some((t) => this.catchMatches(t.name, thrown))) {
            const catchEnv = new Env(env)
            catchEnv.declare(c.name, { name: c.types[0].name, dims: 0 }, thrown.value)
            this.execBlock(c.body, catchEnv, thisVal, cls)
            return
          }
        }
        throw e
      }
    } finally {
      if (s.finally) this.execBlock(s.finally, new Env(env), thisVal, cls)
    }
  }

  private asCatchable(e: unknown): { value: Val; names: Set<string> } | null {
    if (e instanceof ThrownException) {
      const v = e.value
      if (v.k === 'obj') {
        const names = new Set(v.cls.allNames)
        names.add('Throwable')
        return { value: v, names }
      }
      const names = new Set<string>([e.typeName, ...(BUILTIN_EXCEPTIONS[e.typeName] ?? [])])
      names.add('Throwable')
      return { value: v, names }
    }
    if (e instanceof JavaRuntimeError) {
      if (['Timeout', 'StepLimit', 'OutputLimit', 'NoMainMethod', 'NoSuchMethod', 'IncompatibleTypes'].includes(e.javaType)) return null
      const names = new Set<string>([e.javaType, ...(BUILTIN_EXCEPTIONS[e.javaType] ?? [])])
      names.add('Throwable')
      return { value: { k: 'nat', tag: 'Throwable', v: { type: e.javaType, message: e.detail } }, names }
    }
    if (e instanceof RangeError) {
      const names = new Set<string>(['StackOverflowError', 'Error', 'Throwable'])
      return { value: { k: 'nat', tag: 'Throwable', v: { type: 'StackOverflowError', message: '' } }, names }
    }
    return null
  }

  private catchMatches(catchType: string, thrown: { names: Set<string> }): boolean {
    if (catchType === 'Throwable' || catchType === 'Exception') {
      if (catchType === 'Exception' && thrown.names.has('Error')) return false
      return true
    }
    return thrown.names.has(catchType)
  }

  private toThrown(v: Val): ThrownException {
    if (v.k === 'obj') {
      const msg = v.fields.get('__message')
      return new ThrownException(v, v.cls.name, msg && msg.k === 'str' ? msg.v : '')
    }
    if (v.k === 'nat' && v.tag === 'Throwable') {
      const t = v.v as { type: string; message: string }
      return new ThrownException(v, t.type, t.message)
    }
    if (v.k === 'null') throw new JavaRuntimeError('NullPointerException', 'Es wurde null geworfen.')
    return new ThrownException(v, describeKind(v), this.str(v))
  }

  /* ---------------------------- Ausdrücke ---------------------------- */

  private evalInit(init: Expr | ArrayInit, type: TypeRef, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    if ((init as ArrayInit).kind === 'arrayinit') {
      return this.buildArrayFromInit(init as ArrayInit, { ...type, dims: Math.max(0, type.dims - 1) }, env, thisVal, cls)
    }
    return this.eval(init as Expr, env, thisVal, cls)
  }

  private buildArrayFromInit(init: ArrayInit, elemType: TypeRef, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    const values = init.values.map((v) =>
      (v as ArrayInit).kind === 'arrayinit'
        ? this.buildArrayFromInit(v as ArrayInit, { ...elemType, dims: Math.max(0, elemType.dims - 1) }, env, thisVal, cls)
        : coerceToDeclared(elemType, this.eval(v as Expr, env, thisVal, cls)),
    )
    return { k: 'arr', elem: elemType, v: values }
  }

  private eval(e: Expr, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    this.tick()
    this.line = e.line

    switch (e.kind) {
      case 'literal':
        switch (e.type) {
          case 'int': return jint(e.value as number)
          case 'long': return jlong(e.value as bigint)
          case 'double': return jdouble(e.value as number)
          case 'float': return jfloat(e.value as number)
          case 'char': return jchar(e.value as number)
          case 'boolean': return (e.value as boolean) ? TRUE : FALSE
          case 'string': return jstr(e.value as string)
          case 'null': return NULL
        }
        return NULL

      case 'this':
        if (!thisVal) throw new JavaRuntimeError('IncompatibleTypes', '«this» gibt es in einer statischen Methode nicht.')
        return thisVal

      case 'super':
        if (!thisVal) throw new JavaRuntimeError('IncompatibleTypes', '«super» gibt es in einer statischen Methode nicht.')
        return thisVal

      case 'name':
        return this.resolveName(e.name, env, thisVal, cls, e.line)

      case 'field':
        return this.evalField(e.target, e.name, env, thisVal, cls)

      case 'index': {
        const arr = this.eval(e.target, env, thisVal, cls)
        const idx = Math.trunc(asNumber(unbox(this.eval(e.index, env, thisVal, cls))))
        if (arr.k === 'null') throw new JavaRuntimeError('NullPointerException', 'Auf ein Array, das null ist, kann nicht zugegriffen werden.')
        if (arr.k !== 'arr') {
          if (arr.k === 'nat' && arr.tag === 'ArrayList') {
            throw new JavaRuntimeError('IncompatibleTypes', 'Auf eine ArrayList greift man mit get(i) zu, nicht mit [i].')
          }
          throw new JavaRuntimeError('IncompatibleTypes', `${describeKind(arr)} ist kein Array.`)
        }
        if (idx < 0 || idx >= arr.v.length) {
          throw new JavaRuntimeError('ArrayIndexOutOfBoundsException', `Index ${idx} out of bounds for length ${arr.v.length}`)
        }
        return arr.v[idx]
      }

      case 'unary':
        return this.evalUnary(e, env, thisVal, cls)

      case 'binary':
        return this.evalBinary(e, env, thisVal, cls)

      case 'assign':
        return this.evalAssign(e, env, thisVal, cls)

      case 'ternary':
        return asBoolean(this.eval(e.cond, env, thisVal, cls))
          ? this.eval(e.then, env, thisVal, cls)
          : this.eval(e.else, env, thisVal, cls)

      case 'cast': {
        const v = this.eval(e.expr, env, thisVal, cls)
        if (e.type.dims === 0 && PRIMITIVE_NAMES.has(e.type.name)) return castPrimitive(e.type.name as PrimKind, unbox(v))
        if (v.k === 'obj' && !v.cls.allNames.has(e.type.name) && this.classes.has(e.type.name)) {
          throw new JavaRuntimeError('ClassCastException', `class ${v.cls.name} cannot be cast to class ${e.type.name}`)
        }
        return v
      }

      case 'instanceof': {
        const v = this.eval(e.expr, env, thisVal, cls)
        const ok = this.isInstanceOf(v, e.type.name)
        if (ok && e.binding) env.declare(e.binding, e.type, v)
        return jbool(ok)
      }

      case 'new':
        return this.evalNew(e, env, thisVal, cls)

      case 'newarray': {
        if (e.init) {
          const elem: TypeRef = { ...e.type, dims: e.extraDims - 1 + e.sizes.length }
          return this.buildArrayFromInit(e.init, elem, env, thisVal, cls)
        }
        const sizes = e.sizes.map((s) => Math.trunc(asNumber(unbox(this.eval(s, env, thisVal, cls)))))
        return this.makeArray(e.type, sizes, e.extraDims, 0)
      }

      case 'arrayinit':
        return this.buildArrayFromInit(e, { name: 'Object', dims: 0 }, env, thisVal, cls)

      case 'call':
        return this.evalCall(e, env, thisVal, cls)

      case 'lambda':
        return { k: 'fn', params: e.params, body: e.body, env, thisVal }

      case 'classliteral':
        return { k: 'nat', tag: 'Class', v: e.type.name }
    }
  }

  private makeArray(type: TypeRef, sizes: number[], extraDims: number, level: number): Val {
    const len = sizes[level]
    if (len < 0) throw new JavaRuntimeError('NegativeArraySizeException', String(len))
    if (len > 20_000_000) throw new JavaRuntimeError('OutOfMemoryError', 'Requested array size exceeds VM limit')
    const remaining = sizes.length - level - 1 + extraDims
    const elem: TypeRef = { ...type, dims: remaining }
    const arr: Val[] = new Array(len)
    for (let i = 0; i < len; i++) {
      arr[i] = level + 1 < sizes.length ? this.makeArray(type, sizes, extraDims, level + 1) : defaultValue(elem)
    }
    return { k: 'arr', elem, v: arr }
  }

  private isInstanceOf(v: Val, typeName: string): boolean {
    if (v.k === 'null') return false
    if (typeName === 'Object') return true
    switch (v.k) {
      case 'str': return typeName === 'String' || typeName === 'CharSequence' || typeName === 'Comparable'
      case 'arr': return typeName.endsWith('[]')
      case 'obj': return v.cls.allNames.has(typeName)
      case 'int': return typeName === 'Integer' || typeName === 'Number'
      case 'double': return typeName === 'Double' || typeName === 'Number'
      case 'long': return typeName === 'Long' || typeName === 'Number'
      case 'char': return typeName === 'Character'
      case 'boolean': return typeName === 'Boolean'
      case 'nat': {
        if (v.tag === 'Throwable') {
          const t = v.v as { type: string }
          return t.type === typeName || (BUILTIN_EXCEPTIONS[t.type] ?? []).includes(typeName)
        }
        if (v.tag === 'ArrayList') return ['ArrayList', 'List', 'Collection', 'Iterable'].includes(typeName)
        if (v.tag === 'HashMap') return ['HashMap', 'Map'].includes(typeName)
        if (v.tag === 'HashSet') return ['HashSet', 'Set', 'Collection', 'Iterable'].includes(typeName)
        return v.tag === typeName
      }
      default: return false
    }
  }

  /* -------------------------- Namensauflösung -------------------------- */

  private resolveName(name: string, env: Env, thisVal: Val | null, cls: JClass | null, line: number): Val {
    const local = env.lookup(name)
    if (local) return local.v

    /* Unqualifizierte Felder werden ab der Klasse gesucht, in der der Code
       steht — nicht ab der Laufzeitklasse. Genau daran hängt Feldverdeckung. */
    if (thisVal && thisVal.k === 'obj') {
      const hit = this.findField(cls ?? thisVal.cls, name) ?? this.findField(thisVal.cls, name)
      if (hit && !hit.info.isStatic) {
        const key = fieldKey(hit.owner, name)
        if (thisVal.fields.has(key)) return thisVal.fields.get(key)!
      }
    }
    const staticOwner = this.findStaticOwner(cls, name)
    if (staticOwner) {
      this.ensureStatic(staticOwner)
      return staticOwner.staticValues.get(name)!
    }
    const user = this.classes.get(name)
    if (user) {
      this.ensureStatic(user)
      return { k: 'clsref', cls: user }
    }
    if (STATIC_CLASSES.has(name) || ['Object', 'Iterator', 'Comparable', 'Scanner', 'Random', 'StringBuilder', 'Runnable'].includes(name)) {
      return { k: 'nat', tag: 'StaticClass', v: name }
    }
    if (BUILTIN_EXCEPTIONS[name]) return { k: 'nat', tag: 'StaticClass', v: name }
    if (name === 'java' || name === 'javax') return { k: 'nat', tag: 'Package', v: name }

    throw new JavaRuntimeError(
      'CannotFindSymbol',
      `Die Variable «${name}» ist an dieser Stelle nicht bekannt (Zeile ${line}). Prüfe die Schreibweise und ob sie vorher deklariert wurde — in Java gilt eine Variable nur innerhalb des Blocks { … }, in dem sie deklariert wurde.`,
      line,
    )
  }

  /** Sucht ein Instanzfeld ab `cls` aufwärts und liefert die deklarierende Klasse mit. */
  private findField(cls: JClass | null, name: string): { owner: JClass; info: FieldInfo } | null {
    for (let c = cls; c; c = c.superclass) {
      const f = c.fields.find((x) => x.name === name && !x.isStatic)
      if (f) return { owner: c, info: f }
    }
    return null
  }

  /** Statische Felder werden auch aus Interfaces geerbt (Konstanten). */
  private findStaticOwner(cls: JClass | null, name: string, seen = new Set<string>()): JClass | null {
    for (let c = cls; c; c = c.superclass) {
      if (seen.has(c.name)) continue
      seen.add(c.name)
      this.ensureStatic(c)
      if (c.staticValues.has(name)) return c
      for (const iname of c.interfaces) {
        const ic = this.classes.get(iname)
        const hit = ic ? this.findStaticOwner(ic, name, seen) : null
        if (hit) return hit
      }
    }
    return null
  }

  /**
   * Statischer Typ eines Ausdrucks, soweit erkennbar. Java bindet Felder
   * statisch (über den deklarierten Typ) und Methoden dynamisch.
   */
  private staticClassOf(e: Expr, env: Env, thisVal: Val | null, cls: JClass | null): JClass | null {
    switch (e.kind) {
      case 'this':
        return cls
      case 'super':
        return cls?.superclass ?? null
      case 'cast':
        return e.type.dims === 0 ? (this.classes.get(e.type.name) ?? null) : null
      case 'new':
        return this.classes.get(e.type.name) ?? null
      case 'name': {
        const local = env.lookup(e.name)
        if (local) return local.type.dims === 0 ? (this.classes.get(local.type.name) ?? null) : null
        const hit = this.findField(cls ?? (thisVal?.k === 'obj' ? thisVal.cls : null), e.name)
        return hit && hit.info.type.dims === 0 ? (this.classes.get(hit.info.type.name) ?? null) : null
      }
      case 'field': {
        const owner = this.staticClassOf(e.target, env, thisVal, cls)
        const hit = this.findField(owner, e.name)
        return hit && hit.info.type.dims === 0 ? (this.classes.get(hit.info.type.name) ?? null) : null
      }
      default:
        return null
    }
  }

  private evalField(targetExpr: Expr, name: string, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    /* super.feld — beginnt die Suche bei der Oberklasse */
    if (targetExpr.kind === 'super' && thisVal && thisVal.k === 'obj') {
      const hit = this.findField(cls?.superclass ?? null, name)
      if (hit) return thisVal.fields.get(fieldKey(hit.owner, name)) ?? NULL
      return thisVal.fields.get(name) ?? NULL
    }
    const target = this.eval(targetExpr, env, thisVal, cls)

    if (target.k === 'null') {
      throw new JavaRuntimeError(
        'NullPointerException',
        `Cannot read field "${name}" because the value is null`,
      )
    }
    if (target.k === 'arr') {
      if (name === 'length') return jint(target.v.length)
      throw new JavaRuntimeError('NoSuchField', `Ein Array hat nur das Feld «length», nicht «${name}».`)
    }
    if (target.k === 'str') {
      if (name === 'length') {
        throw new JavaRuntimeError('NoSuchField', 'Bei einem String heißt es length() mit Klammern — length ohne Klammern gibt es nur bei Arrays.')
      }
      throw new JavaRuntimeError('NoSuchField', `String hat kein Feld «${name}».`)
    }
    if (target.k === 'nat' && target.tag === 'Package') {
      /* java.util.Arrays … — Paketpfade werden auf den Klassennamen reduziert */
      if (/^[A-Z]/.test(name)) {
        const user = this.classes.get(name)
        if (user) {
          this.ensureStatic(user)
          return { k: 'clsref', cls: user }
        }
        return { k: 'nat', tag: 'StaticClass', v: name }
      }
      return { k: 'nat', tag: 'Package', v: `${String(target.v)}.${name}` }
    }
    if (target.k === 'nat' && target.tag === 'StaticClass') {
      const sf = staticField(String(target.v), name)
      if (sf) return sf
      throw new JavaRuntimeError('NoSuchField', `${String(target.v)}.${name} gibt es nicht.`)
    }
    if (target.k === 'clsref') {
      const c = target.cls
      const owner = this.findStaticOwner(c, name)
      if (owner) return owner.staticValues.get(name)!
      if (c.decl.type === 'enum' && c.enumConstants.has(name)) return c.enumConstants.get(name)!
      const nested = this.classes.get(name)
      if (nested) return { k: 'clsref', cls: nested }
      throw new JavaRuntimeError('NoSuchField', `Die Klasse ${c.name} hat kein statisches Feld «${name}».`)
    }
    if (target.k === 'obj') {
      /* Felder binden statisch: der deklarierte Typ entscheidet, nicht das Objekt. */
      const declared = this.staticClassOf(targetExpr, env, thisVal, cls)
      const hit = this.findField(declared, name) ?? this.findField(target.cls, name)
      if (hit) {
        const key = fieldKey(hit.owner, name)
        if (target.fields.has(key)) return target.fields.get(key)!
      }
      if (target.fields.has(name)) return target.fields.get(name)!
      const owner = this.findStaticOwner(target.cls, name)
      if (owner) return owner.staticValues.get(name)!
      throw new JavaRuntimeError('NoSuchField', `Die Klasse ${target.cls.name} hat kein Feld «${name}».`)
    }
    throw new JavaRuntimeError('NoSuchField', `${describeKind(target)} hat kein Feld «${name}».`)
  }

  /* ------------------------------ Aufrufe ------------------------------ */

  private evalCall(e: Extract<Expr, { kind: 'call' }>, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    const args = e.args.map((a) => this.eval(a, env, thisVal, cls))

    /* this(...) / super(...) werden beim Objektaufbau verarbeitet (siehe construct). */
    if (e.target === null && (e.name === 'this' || e.name === 'super')) {
      return NULL
    }

    /* unqualifizierter Aufruf */
    if (e.target === null) {
      const local = env.lookup(e.name)
      if (local && local.v.k === 'fn') return this.callFunctional(local.v, args)

      if (thisVal && thisVal.k === 'obj') {
        const hit = this.findMethod(thisVal.cls, e.name, args)
        if (hit) return this.invoke(hit.m, hit.m.modifiers.includes('static') ? null : thisVal, hit.cls, args)
      }
      for (let c = cls; c; c = c.superclass) {
        const hit = this.findMethod(c, e.name, args)
        if (hit) {
          if (!hit.m.modifiers.includes('static') && !thisVal) {
            throw new JavaRuntimeError(
              'NonStaticFromStatic',
              `Die Methode ${e.name}(…) ist nicht statisch und kann deshalb nicht direkt aus main heraus aufgerufen werden. ` +
                `Entweder «static» ergänzen oder erst ein Objekt erzeugen: new ${c.name}().${e.name}(…).`,
            )
          }
          return this.invoke(hit.m, hit.m.modifiers.includes('static') ? null : thisVal, hit.cls, args)
        }
      }
      if (thisVal && thisVal.k === 'obj') return this.objectFallback(thisVal, e.name, args)
      throw new JavaRuntimeError('CannotFindSymbol', `Die Methode «${e.name}(…)» ist hier nicht bekannt.`)
    }

    /* super.methode(...) — statische Bindung an die Oberklasse */
    if (e.target.kind === 'super') {
      if (!thisVal || thisVal.k !== 'obj') throw new JavaRuntimeError('IncompatibleTypes', '«super» gibt es hier nicht.')
      const sup = cls?.superclass
      if (!sup) {
        if (e.name === 'toString') return jstr(`${thisVal.cls.name}@${this.idHex(thisVal)}`)
        if (e.name === 'getMessage') return thisVal.fields.get('__message') ?? NULL
        if (e.name === 'equals') return jbool(thisVal === args[0])
        if (e.name === 'hashCode') return jint(hashOf(thisVal, this))
        return NULL
      }
      const hit = this.findMethod(sup, e.name, args)
      if (!hit) throw new JavaRuntimeError('CannotFindSymbol', `Die Oberklasse ${sup.name} hat keine Methode «${e.name}(…)».`)
      return this.invoke(hit.m, thisVal, hit.cls, args)
    }

    const target = this.eval(e.target, env, thisVal, cls)
    return this.callOn(target, e.name, args)
  }

  callOn(target: Val, name: string, args: Val[]): Val {
    if (target.k === 'null') {
      throw new JavaRuntimeError(
        'NullPointerException',
        `Cannot invoke "${name}()" because the value is null`,
      )
    }
    if (target.k === 'str') return stringMethod(target, name, args, this)

    if (target.k === 'arr') {
      if (name === 'clone') return { k: 'arr', elem: target.elem, v: [...target.v] }
      if (name === 'length') throw new JavaRuntimeError('NoSuchMethod', 'Bei Arrays heißt es length ohne Klammern.')
      if (name === 'toString') return jstr(this.str(target))
      if (name === 'getClass') return { k: 'nat', tag: 'Class', v: arrayTag(target.elem) }
      throw new JavaRuntimeError('NoSuchMethod', `Ein Array hat keine Methode «${name}()». Für die Ausgabe: Arrays.toString(array).`)
    }

    if (target.k === 'nat' && target.tag === 'StaticClass') {
      const clsName = String(target.v)
      const r = staticMethod(clsName, name, args, this)
      if (r !== undefined) return r
      throw new JavaRuntimeError('NoSuchMethod', `${clsName}.${name}(…) gibt es nicht.`)
    }

    if (target.k === 'clsref') {
      const c = target.cls
      this.ensureStatic(c)
      if (c.decl.type === 'enum') {
        if (name === 'values') {
          return { k: 'arr', elem: { name: c.name, dims: 0 }, v: [...c.enumConstants.values()] }
        }
        if (name === 'valueOf') {
          const key = this.str(args[0])
          const v = c.enumConstants.get(key)
          if (!v) throw new JavaRuntimeError('IllegalArgumentException', `No enum constant ${c.name}.${key}`)
          return v
        }
      }
      const hit = this.findMethod(c, name, args)
      if (hit) return this.invoke(hit.m, null, hit.cls, args)
      throw new JavaRuntimeError('NoSuchMethod', `Die Klasse ${c.name} hat keine statische Methode «${name}(…)».`)
    }

    if (target.k === 'obj') {
      const hit = this.findMethod(target.cls, name, args)
      if (hit) return this.invoke(hit.m, hit.m.modifiers.includes('static') ? null : target, hit.cls, args)
      return this.objectFallback(target, name, args)
    }

    if (target.k === 'fn') return this.callFunctional(target, args)

    if (target.k === 'nat') return nativeMethod(target, name, args, this)

    /* Autoboxing: 5.compareTo(...) o. Ä. */
    if (isNumeric(target) || target.k === 'boolean') {
      const boxed: Val = { k: 'nat', tag: boxTag(target), v: target }
      return nativeMethod(boxed as Val & { k: 'nat' }, name, args, this)
    }

    throw new JavaRuntimeError('NoSuchMethod', `${describeKind(target)} hat keine Methode «${name}(…)».`)
  }

  private objectFallback(obj: Val & { k: 'obj' }, name: string, args: Val[]): Val {
    switch (name) {
      case 'toString': return jstr(this.str(obj))
      case 'equals': return jbool(obj === args[0])
      case 'hashCode': return jint(hashOf(obj, this))
      case 'getClass': return { k: 'nat', tag: 'Class', v: obj.cls.name }
      case 'getMessage': case 'getLocalizedMessage': return obj.fields.get('__message') ?? NULL
      case 'printStackTrace': {
        const msg = obj.fields.get('__message')
        this.print(`${obj.cls.name}${msg && msg.k === 'str' ? ': ' + msg.v : ''}\n`, true)
        return NULL
      }
      case 'name': if (obj.cls.decl.type === 'enum') return obj.fields.get('$name') ?? NULL; break
      case 'ordinal': if (obj.cls.decl.type === 'enum') return obj.fields.get('$ordinal') ?? jint(0); break
      case 'compareTo':
        if (obj.cls.decl.type === 'enum' && args[0].k === 'obj') {
          return jint(asNumber(obj.fields.get('$ordinal') ?? jint(0)) - asNumber(args[0].fields.get('$ordinal') ?? jint(0)))
        }
        break
    }
    /* Record-Accessoren */
    if (obj.cls.decl.type === 'record' && args.length === 0) {
      const hit = this.findField(obj.cls, name)
      if (hit) return obj.fields.get(fieldKey(hit.owner, name)) ?? NULL
    }
    /* Basisverhalten von Thread, wenn die Klasse davon erbt */
    if (obj.cls.allNames.has('Thread')) {
      switch (name) {
        case 'start': {
          const run = this.findMethod(obj.cls, 'run', [])
          if (run) this.invoke(run.m, obj, run.cls, [])
          return NULL
        }
        case 'join': case 'interrupt': case 'setDaemon': case 'setPriority':
          return NULL
        case 'isAlive': case 'isInterrupted':
          return jbool(false)
        case 'setName':
          obj.fields.set('__threadName', args[0])
          return NULL
        case 'getName': {
          const n = obj.fields.get('__threadName')
          return n && n.k === 'str' ? n : jstr('Thread-0')
        }
      }
    }
    throw new JavaRuntimeError(
      'NoSuchMethod',
      `Die Klasse ${obj.cls.name} hat keine Methode «${name}(${args.map((a) => describeKind(a)).join(', ')})».`,
    )
  }

  /* --------------------- Methodenauswahl (Overloading) --------------------- */

  private findMethod(cls: JClass | null, name: string, args: Val[]): { m: MethodDecl; cls: JClass } | null {
    const candidates: { m: MethodDecl; cls: JClass }[] = []
    const seen = new Set<string>()
    for (let c = cls; c; c = c.superclass) {
      for (const m of c.methods.get(name) ?? []) {
        const sig = `${m.params.length}:${m.params.map((p) => p.type.name + '['.repeat(p.type.dims)).join(',')}`
        if (seen.has(sig) || !m.body) {
          if (!m.body && !seen.has(sig)) continue
          continue
        }
        seen.add(sig)
        candidates.push({ m, cls: c })
      }
      /* Default-Methoden aus Interfaces */
      for (const iname of c.interfaces) {
        const ic = this.classes.get(iname)
        if (!ic) continue
        for (const m of ic.methods.get(name) ?? []) {
          if (!m.body) continue
          const sig = `${m.params.length}:i:${m.params.map((p) => p.type.name).join(',')}`
          if (seen.has(sig)) continue
          seen.add(sig)
          candidates.push({ m, cls: ic })
        }
      }
    }
    if (!candidates.length) return null
    const best = this.rank(candidates, args)
    return best
  }

  private rank(cands: { m: MethodDecl; cls: JClass }[], args: Val[]): { m: MethodDecl; cls: JClass } | null {
    let best: { m: MethodDecl; cls: JClass } | null = null
    let bestScore = -Infinity
    for (const c of cands) {
      const score = this.score(c.m.params, args)
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    return bestScore === -Infinity ? null : best
  }

  private score(params: Param[], args: Val[]): number {
    const varargs = params.length > 0 && params[params.length - 1].varargs
    if (!varargs && params.length !== args.length) return -Infinity
    if (varargs && args.length < params.length - 1) return -Infinity

    let total = varargs ? -0.5 : 0
    const fixed = varargs ? params.length - 1 : params.length
    for (let i = 0; i < fixed; i++) {
      const s = this.paramScore(params[i].type, args[i])
      if (s < 0) return -Infinity
      total += s
    }
    if (varargs) {
      const elem = { ...params[params.length - 1].type, dims: params[params.length - 1].type.dims - 1 }
      for (let i = fixed; i < args.length; i++) {
        const s = this.paramScore(elem, args[i])
        if (s < 0) return -Infinity
        total += s * 0.5
      }
    }
    return total
  }

  private paramScore(type: TypeRef, arg: Val): number {
    if (arg === undefined) return -1
    const v = arg
    if (type.dims > 0) return v.k === 'arr' ? 4 : v.k === 'null' ? 2 : -1
    const t = type.name

    if (PRIMITIVE_NAMES.has(t)) {
      const u = unbox(v)
      if (t === 'boolean') return u.k === 'boolean' ? 4 : -1
      if (!isNumeric(u)) return -1
      if (u.k === t) return 4
      if ((WIDENING[u.k] ?? []).includes(t)) return 3
      return 0.5 // Verengung — Java verbietet das, wir sind hier nachsichtig
    }
    switch (t) {
      case 'String': case 'CharSequence': return v.k === 'str' ? 4 : v.k === 'null' ? 2 : -1
      case 'Object': return 1
      case 'Integer': return v.k === 'int' ? 4 : v.k === 'null' ? 2 : isNumeric(v) ? 1 : -1
      case 'Double': return v.k === 'double' ? 4 : v.k === 'null' ? 2 : isNumeric(v) ? 1 : -1
      case 'Long': return v.k === 'long' ? 4 : v.k === 'null' ? 2 : isNumeric(v) ? 1 : -1
      case 'Character': return v.k === 'char' ? 4 : v.k === 'null' ? 2 : -1
      case 'Boolean': return v.k === 'boolean' ? 4 : v.k === 'null' ? 2 : -1
    }
    if (v.k === 'null') return 2
    if (v.k === 'obj') return v.cls.name === t ? 4 : v.cls.allNames.has(t) ? 3 : -1
    if (v.k === 'nat') {
      if (v.tag === t) return 4
      if (this.isInstanceOf(v, t)) return 3
      return -1
    }
    if (v.k === 'fn') return 2
    if (v.k === 'arr') return -1
    return isNumeric(v) || v.k === 'boolean' ? 0.5 : -1
  }

  private pickMethod(cands: MethodDecl[], args: Val[], className: string): MethodDecl {
    let best: MethodDecl | null = null
    let bestScore = -Infinity
    for (const m of cands) {
      const s = this.score(m.params, args)
      if (s > bestScore) {
        bestScore = s
        best = m
      }
    }
    if (!best || bestScore === -Infinity) {
      throw new JavaRuntimeError(
        'CannotFindSymbol',
        `Zu ${className}(${args.map((a) => describeKind(a)).join(', ')}) gibt es keinen passenden Konstruktor.`,
      )
    }
    return best
  }

  /* ---------------------------- Ausführung ---------------------------- */

  invoke(m: MethodDecl, thisVal: Val | null, cls: JClass, args: Val[]): Val {
    if (!m.body) {
      throw new JavaRuntimeError('AbstractMethodError', `Die Methode ${m.name}(…) hat keinen Rumpf.`)
    }
    if (++this.depth > 2400) {
      this.depth--
      throw new JavaRuntimeError(
        'StackOverflowError',
        'Die Rekursion ist zu tief. Fehlt eine Abbruchbedingung (Basisfall)?',
      )
    }
    try {
      const env = new Env(null)
      this.bindParams(m, args, env)
      try {
        this.execBlock(m.body, env, thisVal, cls)
      } catch (e) {
        if (e instanceof ReturnSignal) {
          return m.isConstructor ? NULL : coerceToDeclared(m.returnType, e.value)
        }
        throw e
      }
      return NULL
    } finally {
      this.depth--
    }
  }

  private evalNew(e: Extract<Expr, { kind: 'new' }>, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    const args = e.args.map((a) => this.eval(a, env, thisVal, cls))
    const name = e.type.name

    if (e.body) {
      this.register(e.body)
      const anon = this.classes.get(e.body.name)!
      this.link(anon)
      return this.instantiate(anon, args, env)
    }

    const user = this.classes.get(name)
    if (user) return this.instantiate(user, args, env)

    const nat = constructNative(name, args, this)
    if (nat) return nat

    if (BUILTIN_EXCEPTIONS[name]) {
      return { k: 'nat', tag: 'Throwable', v: { type: name, message: args.length ? this.str(args[0]) : '' } }
    }

    throw new JavaRuntimeError(
      'CannotFindSymbol',
      `Die Klasse «${name}» ist nicht bekannt. Entweder ist sie nicht definiert oder sie gehört zu einem Teil der Java-Bibliothek, den dieser Compiler nicht unterstützt.`,
    )
  }

  private instantiate(cls: JClass, args: Val[], env: Env): Val {
    if (cls.isAbstract) {
      throw new JavaRuntimeError(
        'InstantiationError',
        `${cls.name} ist ${cls.isInterface ? 'ein Interface' : 'abstrakt'} und kann nicht mit new erzeugt werden.`,
      )
    }
    this.ensureStatic(cls)
    const obj: Val & { k: 'obj' } = { k: 'obj', cls, fields: new Map<string, Val>() }
    this.initFields(obj, cls)

    /* Records: Komponenten direkt zuweisen */
    if (cls.decl.type === 'record' && cls.decl.recordComponents && cls.ctors.length === 0) {
      cls.decl.recordComponents.forEach((rc, i) => {
        obj.fields.set(fieldKey(cls, rc.name), coerceToDeclared(rc.type, args[i] ?? NULL))
      })
      return obj
    }

    this.construct(cls, obj, args, env)
    return obj
  }

  /**
   * Objektaufbau in der Reihenfolge der JVM:
   *   1. Oberklasse vollständig aufbauen (super(...) — notfalls implizit)
   *   2. eigene Feldinitialisierer und Initialisierungsblöcke
   *   3. Rumpf des Konstruktors
   *
   * Daraus folgt die klassische Prüfungsfalle: Ruft der Oberklassen-
   * Konstruktor eine überschriebene Methode auf, sind die Felder der
   * Unterklasse noch auf ihrem Standardwert.
   */
  private construct(cls: JClass, obj: Val & { k: 'obj' }, args: Val[], env: Env) {
    this.ensureStatic(cls)
    if (++this.depth > 2400) {
      this.depth--
      throw new JavaRuntimeError('StackOverflowError', 'Die Konstruktorkette ist zu tief verschachtelt.')
    }
    try {
      const ctor = cls.ctors.length ? this.pickMethod(cls.ctors, args, cls.name) : null

      if (!ctor) {
        if (cls.superclass) this.construct(cls.superclass, obj, [], env)
        else this.applyBuiltinSuper(cls, obj, args)
        this.initFieldValues(obj, cls, env)
        return
      }

      /* Parameter binden — die Argumente von this(...)/super(...) dürfen sie nutzen. */
      const local = new Env(null)
      this.bindParams(ctor, args, local)

      const stmts = ctor.body?.stmts ?? []
      const first = stmts[0]
      let chained: 'this' | 'super' | null = null
      let chainArgs: Val[] = []
      if (
        first?.kind === 'exprstmt' &&
        first.expr.kind === 'call' &&
        first.expr.target === null &&
        (first.expr.name === 'this' || first.expr.name === 'super')
      ) {
        chained = first.expr.name
        chainArgs = first.expr.args.map((a) => this.eval(a, local, obj, cls))
      }

      if (chained === 'this') {
        this.construct(cls, obj, chainArgs, env)
      } else {
        if (cls.superclass) this.construct(cls.superclass, obj, chainArgs, env)
        else this.applyBuiltinSuper(cls, obj, chainArgs)
        this.initFieldValues(obj, cls, env)
      }

      const body = chained ? stmts.slice(1) : stmts
      try {
        const scope = new Env(local)
        for (const st of body) this.exec(st, scope, obj, cls)
      } catch (e) {
        if (!(e instanceof ReturnSignal)) throw e
      }
    } finally {
      this.depth--
    }
  }

  /** super(...) einer eingebauten Oberklasse (Exception, Thread …). */
  private applyBuiltinSuper(cls: JClass, obj: Val & { k: 'obj' }, args: Val[]) {
    if (!args.length) return
    if (this.isThrowableClass(cls) && args[0].k === 'str') obj.fields.set('__message', args[0])
    else if (cls.allNames.has('Thread') && args[0].k === 'str') obj.fields.set('__threadName', args[0])
  }

  private bindParams(m: MethodDecl, args: Val[], env: Env) {
    const varargs = m.params.length > 0 && m.params[m.params.length - 1].varargs
    const fixed = varargs ? m.params.length - 1 : m.params.length
    for (let i = 0; i < fixed; i++) {
      env.declare(m.params[i].name, m.params[i].type, coerceToDeclared(m.params[i].type, args[i] ?? NULL))
    }
    if (varargs) {
      const last = m.params[m.params.length - 1]
      const rest = args.slice(fixed)
      const packed: Val =
        rest.length === 1 && rest[0].k === 'arr'
          ? rest[0]
          : { k: 'arr', elem: { ...last.type, dims: last.type.dims - 1 }, v: rest }
      env.declare(last.name, last.type, packed)
    }
  }

  private initFields(obj: Val & { k: 'obj' }, cls: JClass) {
    for (let c: JClass | null = cls; c; c = c.superclass) {
      for (const f of c.fields) {
        if (!f.isStatic) obj.fields.set(fieldKey(c, f.name), defaultValue(f.type))
      }
    }
  }

  private initFieldValues(obj: Val & { k: 'obj' }, cls: JClass, env: Env) {
    for (const f of cls.fields) {
      if (f.isStatic || !f.init) continue
      obj.fields.set(fieldKey(cls, f.name), coerceToDeclared(f.type, this.evalInit(f.init, f.type, new Env(env), obj, cls)))
    }
    for (const b of cls.instanceInit) this.execBlock(b.body, new Env(env), obj, cls)
  }

  /* ------------------------- Operatoren ------------------------- */

  private evalBinary(e: Extract<Expr, { kind: 'binary' }>, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    if (e.op === '&&') {
      return asBoolean(this.eval(e.left, env, thisVal, cls)) ? jbool(asBoolean(this.eval(e.right, env, thisVal, cls))) : FALSE
    }
    if (e.op === '||') {
      return asBoolean(this.eval(e.left, env, thisVal, cls)) ? TRUE : jbool(asBoolean(this.eval(e.right, env, thisVal, cls)))
    }

    const a = this.eval(e.left, env, thisVal, cls)
    const b = this.eval(e.right, env, thisVal, cls)

    switch (e.op) {
      case '+':
        if (a.k === 'str' || b.k === 'str') {
          const text = this.str(a) + this.str(b)
          /* Der Compiler faltet konstante Ausdrücke: "Ja" + "va" landet im
             String-Pool und ist identisch zum Literal "Java". Sobald eine
             Variable beteiligt ist, entsteht zur Laufzeit ein neues Objekt. */
          return isConstantString(e.left) && isConstantString(e.right) ? jstr(text) : jstrNew(text)
        }
        return arith('+', unbox(a), unbox(b))
      case '-': case '*': case '/': case '%':
        return arith(e.op, unbox(a), unbox(b))
      case '==': return jbool(refEquals(a.k === 'nat' ? unbox(a) : a, b.k === 'nat' ? unbox(b) : b))
      case '!=': return jbool(!refEquals(a.k === 'nat' ? unbox(a) : a, b.k === 'nat' ? unbox(b) : b))
      case '<': case '>': case '<=': case '>=':
        return jbool(compare(e.op, unbox(a), unbox(b)))
      case '&': case '|': case '^':
        return bitwise(e.op, unbox(a), unbox(b))
      case '<<': case '>>': case '>>>':
        return shift(e.op, unbox(a), unbox(b))
    }
    throw new JavaRuntimeError('IncompatibleTypes', `Unbekannter Operator «${e.op}».`)
  }

  private evalUnary(e: Extract<Expr, { kind: 'unary' }>, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    if (e.op === '++' || e.op === '--') {
      const old = unbox(this.eval(e.expr, env, thisVal, cls))
      const one: Val = old.k === 'long' ? jlong(1n) : jint(1)
      const next = arith(e.op === '++' ? '+' : '-', old, one)
      const narrowed = old.k === 'char' || old.k === 'byte' || old.k === 'short'
        ? castPrimitive(old.k as PrimKind, next)
        : old.k === 'double' ? jdouble(asNumber(next)) : old.k === 'float' ? jfloat(asNumber(next)) : next
      this.store(e.expr, narrowed, env, thisVal, cls)
      return e.prefix ? narrowed : old
    }

    const v = unbox(this.eval(e.expr, env, thisVal, cls))
    switch (e.op) {
      case '+': return isNumeric(v) && (v.k === 'char' || v.k === 'byte' || v.k === 'short') ? jint(asNumber(v)) : v
      case '-':
        if (v.k === 'long') return jlong(-v.v)
        if (v.k === 'double') return jdouble(-v.v)
        if (v.k === 'float') return jfloat(-v.v)
        return jint(-asNumber(v) | 0)
      case '!': return jbool(!asBoolean(v))
      case '~':
        if (v.k === 'long') return jlong(~v.v)
        return jint(~(asNumber(v) | 0))
    }
    throw new JavaRuntimeError('IncompatibleTypes', `Unbekannter Operator «${e.op}».`)
  }

  private evalAssign(e: Extract<Expr, { kind: 'assign' }>, env: Env, thisVal: Val | null, cls: JClass | null): Val {
    let value: Val
    if (e.op === '=') {
      value = (e.value as ArrayInit).kind === 'arrayinit'
        ? this.buildArrayFromInit(e.value as ArrayInit, { name: 'Object', dims: 0 }, env, thisVal, cls)
        : this.eval(e.value, env, thisVal, cls)
    } else {
      const cur = this.eval(e.target, env, thisVal, cls)
      const rhs = this.eval(e.value, env, thisVal, cls)
      const op = e.op.slice(0, -1)
      if (op === '+' && cur.k === 'str') value = jstrNew(cur.v + this.str(rhs))
      else if (['&', '|', '^'].includes(op)) value = bitwise(op, unbox(cur), unbox(rhs))
      else if (['<<', '>>', '>>>'].includes(op)) value = shift(op, unbox(cur), unbox(rhs))
      else value = arith(op, unbox(cur), unbox(rhs))
      // Verbundzuweisung enthält in Java einen impliziten Cast auf den Zieltyp
      const c = unbox(cur)
      if (isNumeric(c) && c.k !== 'double' && !(c.k === 'int' && value.k === 'int')) {
        value = castPrimitive(c.k as PrimKind, value)
      }
    }
    this.store(e.target, value, env, thisVal, cls)
    return value
  }

  private store(target: Expr, value: Val, env: Env, thisVal: Val | null, cls: JClass | null) {
    if (target.kind === 'name') {
      if (env.assign(target.name, value)) return
      if (thisVal && thisVal.k === 'obj') {
        const hit = this.findField(cls ?? thisVal.cls, target.name) ?? this.findField(thisVal.cls, target.name)
        if (hit) {
          thisVal.fields.set(fieldKey(hit.owner, target.name), coerceToDeclared(hit.info.type, value))
          return
        }
      }
      const owner = this.findStaticOwner(cls, target.name)
      if (owner) {
        const f = owner.fields.find((x) => x.name === target.name && x.isStatic)
        owner.staticValues.set(target.name, f ? coerceToDeclared(f.type, value) : value)
        return
      }
      throw new JavaRuntimeError('CannotFindSymbol', `Die Variable «${target.name}» wurde nicht deklariert.`)
    }

    if (target.kind === 'field') {
      const obj = target.target.kind === 'super' ? thisVal! : this.eval(target.target, env, thisVal, cls)
      if (obj.k === 'null') throw new JavaRuntimeError('NullPointerException', `Cannot assign field "${target.name}" because the value is null`)
      if (obj.k === 'obj') {
        const declared =
          target.target.kind === 'super'
            ? (cls?.superclass ?? null)
            : this.staticClassOf(target.target, env, thisVal, cls)
        const hit = this.findField(declared, target.name) ?? this.findField(obj.cls, target.name)
        if (hit) {
          obj.fields.set(fieldKey(hit.owner, target.name), coerceToDeclared(hit.info.type, value))
          return
        }
        const so = this.findStaticOwner(obj.cls, target.name)
        if (so) {
          so.staticValues.set(target.name, value)
          return
        }
        obj.fields.set(target.name, value)
        return
      }
      if (obj.k === 'clsref') {
        const c = obj.cls
        const so = this.findStaticOwner(c, target.name)
        if (so) {
          const f = so.fields.find((y) => y.name === target.name && y.isStatic)
          so.staticValues.set(target.name, f ? coerceToDeclared(f.type, value) : value)
          return
        }
      }
      throw new JavaRuntimeError('NoSuchField', `«${target.name}» kann hier nicht zugewiesen werden.`)
    }

    if (target.kind === 'index') {
      const arr = this.eval(target.target, env, thisVal, cls)
      const idx = Math.trunc(asNumber(unbox(this.eval(target.index, env, thisVal, cls))))
      if (arr.k === 'null') throw new JavaRuntimeError('NullPointerException', 'Das Array ist null.')
      if (arr.k !== 'arr') throw new JavaRuntimeError('IncompatibleTypes', `${describeKind(arr)} ist kein Array.`)
      if (idx < 0 || idx >= arr.v.length) {
        throw new JavaRuntimeError('ArrayIndexOutOfBoundsException', `Index ${idx} out of bounds for length ${arr.v.length}`)
      }
      arr.v[idx] = coerceToDeclared(arr.elem, value)
      return
    }

    throw new JavaRuntimeError('IncompatibleTypes', 'Diesem Ausdruck kann nichts zugewiesen werden.')
  }
}

/** Ist der Ausdruck eine Konstante, die der Compiler zusammenfassen darf? */
function isConstantString(e: Expr): boolean {
  if (e.kind === 'literal') return true
  if (e.kind === 'binary' && e.op === '+') return isConstantString(e.left) && isConstantString(e.right)
  return false
}

/** Instanzfelder werden je deklarierender Klasse abgelegt — sonst würde
    ein gleichnamiges Feld der Unterklasse das der Oberklasse überschreiben. */
function fieldKey(owner: { name: string }, name: string): string {
  return `${owner.name}#${name}`
}

function arrayTag(elem: TypeRef): string {
  if (elem.dims > 0) return '[' + arrayTag({ ...elem, dims: elem.dims - 1 })
  switch (elem.name) {
    case 'int': return '[I'
    case 'long': return '[J'
    case 'double': return '[D'
    case 'float': return '[F'
    case 'char': return '[C'
    case 'boolean': return '[Z'
    case 'byte': return '[B'
    case 'short': return '[S'
    default: return `[L${elem.name};`
  }
}

function boxTag(v: Val): string {
  switch (v.k) {
    case 'int': case 'short': case 'byte': return 'Integer'
    case 'long': return 'Long'
    case 'double': return 'Double'
    case 'float': return 'Float'
    case 'char': return 'Character'
    case 'boolean': return 'Boolean'
    default: return 'Object'
  }
}

function inferType(v: Val): TypeRef {
  switch (v.k) {
    case 'int': case 'long': case 'double': case 'float': case 'char': case 'boolean': case 'byte': case 'short':
      return { name: v.k, dims: 0 }
    case 'str': return { name: 'String', dims: 0 }
    case 'arr': return { ...v.elem, dims: v.elem.dims + 1 }
    case 'obj': return { name: v.cls.name, dims: 0 }
    default: return { name: 'Object', dims: 0 }
  }
}

export { javaFormat }
