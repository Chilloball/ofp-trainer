import { JavaSyntaxError, tokenize, type Token } from './lexer'
import type {
  ArrayInit, Block, CatchClause, ClassDecl, CompilationUnit, EnumConstant, Expr, FieldDecl,
  InitBlock, Member, MethodDecl, Modifier, Param, Stmt, SwitchCase, TypeRef, VarDeclarator,
} from './ast'

/* ==================================================================== *
 *  Java-Parser (rekursiver Abstieg)
 *
 *  Deckt den Sprachumfang der Vorlesung ab: Klassen, Interfaces, Enums,
 *  Vererbung, Generics (werden gelöscht), Arrays, alle Kontrollstrukturen,
 *  Ausnahmebehandlung und den vollständigen Operatorensatz.
 * ==================================================================== */

const MODIFIERS = new Set<string>([
  'public', 'private', 'protected', 'static', 'final', 'abstract',
  'synchronized', 'native', 'transient', 'volatile', 'strictfp', 'default',
])

const PRIMITIVES = new Set(['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'void'])

/** Startet an dieser Stelle ein Ausdruck? (für Cast-Erkennung) */
const EXPR_STARTERS = new Set(['(', '!', '~', '+', '-', '++', '--'])

export class Parser {
  private toks: Token[]
  private p = 0

  constructor(src: string) {
    this.toks = tokenize(src)
  }

  /* ------------------------------ Hilfen ------------------------------ */

  private peek(offset = 0): Token {
    return this.toks[Math.min(this.p + offset, this.toks.length - 1)]
  }
  private get cur(): Token {
    return this.toks[this.p]
  }
  private next(): Token {
    return this.toks[this.p++]
  }
  private at(text: string, offset = 0): boolean {
    const t = this.peek(offset)
    return t.text === text && (t.kind === 'op' || t.kind === 'keyword')
  }
  /** Als Methode formuliert, damit die Typprüfung den Zustand nicht einfriert. */
  private atEnd(): boolean {
    return this.toks[this.p].kind === 'eof'
  }
  private eat(text: string): boolean {
    if (this.at(text)) {
      this.p++
      return true
    }
    return false
  }
  private expect(text: string, hint?: string): Token {
    if (this.at(text)) return this.next()
    this.fail(`Hier wird «${text}» erwartet, gefunden wurde «${this.cur.text}».${hint ? ' ' + hint : ''}`)
  }
  private expectIdent(what: string): string {
    if (this.cur.kind === 'ident') return this.next().text
    // erlaubte "weiche" Schlüsselwörter als Namen
    if (this.cur.kind === 'keyword' && ['var', 'record', 'yield'].includes(this.cur.text)) return this.next().text
    this.fail(`${what} erwartet, gefunden wurde «${this.cur.text}».`)
  }
  private fail(msg: string): never {
    throw new JavaSyntaxError(msg, this.cur.line, this.cur.col)
  }
  private pos() {
    return { line: this.cur.line, col: this.cur.col }
  }
  private save() {
    return this.p
  }
  private restore(mark: number) {
    this.p = mark
  }

  /* ------------------------- Übersetzungseinheit ------------------------- */

  parseCompilationUnit(): CompilationUnit {
    const unit: CompilationUnit = { imports: [], types: [] }

    while (this.at('@')) this.skipAnnotation()
    if (this.at('package')) {
      this.next()
      unit.packageName = this.qualifiedName()
      this.expect(';')
    }
    while (this.at('import')) {
      this.next()
      this.eat('static')
      let name = this.qualifiedName()
      if (this.eat('.')) {
        this.expect('*')
        name += '.*'
      }
      unit.imports.push(name)
      this.expect(';')
    }

    while (!this.atEnd()) {
      if (this.eat(';')) continue
      unit.types.push(this.parseTypeDecl())
    }

    if (unit.types.length === 0) {
      throw new JavaSyntaxError(
        'Die Datei enthält keine Klasse. Java-Code muss immer in einer Klasse stehen, z. B.:\n' +
          'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hallo");\n    }\n}',
        1,
        1,
      )
    }
    return unit
  }

  private qualifiedName(): string {
    let s = this.expectIdent('Name')
    while (this.at('.') && this.peek(1).kind === 'ident') {
      this.next()
      s += '.' + this.next().text
    }
    return s
  }

  private skipAnnotation() {
    this.expect('@')
    this.qualifiedName()
    if (this.at('(')) this.skipBalanced('(', ')')
  }

  private skipBalanced(open: string, close: string) {
    this.expect(open)
    let depth = 1
    while (depth > 0 && !this.atEnd()) {
      if (this.at(open)) depth++
      else if (this.at(close)) depth--
      this.next()
    }
  }

  private parseModifiers(): Modifier[] {
    const mods: Modifier[] = []
    for (;;) {
      if (this.at('@')) {
        this.skipAnnotation()
        continue
      }
      if (this.cur.kind === 'keyword' && MODIFIERS.has(this.cur.text)) {
        mods.push(this.next().text as Modifier)
        continue
      }
      break
    }
    return mods
  }

  /* ---------------------------- Typangaben ---------------------------- */

  private parseType(): TypeRef {
    let name: string
    if (this.cur.kind === 'keyword' && PRIMITIVES.has(this.cur.text)) {
      name = this.next().text
    } else if (this.at('var')) {
      this.next()
      name = 'var'
    } else {
      name = this.expectIdent('Typname')
      // qualifizierte Typen (java.util.List) auf den letzten Teil reduzieren
      while (this.at('.') && this.peek(1).kind === 'ident' && /^[A-Z]/.test(this.peek(1).text)) {
        this.next()
        name = this.next().text
      }
    }
    let args: TypeRef[] | undefined
    if (this.at('<')) args = this.parseTypeArgs()

    let dims = 0
    while (this.at('[') && this.at(']', 1)) {
      this.next()
      this.next()
      dims++
    }
    return { name, dims, args }
  }

  private parseTypeArgs(): TypeRef[] {
    this.expect('<')
    const args: TypeRef[] = []
    if (this.eat('>')) return args
    for (;;) {
      if (this.at('?')) {
        this.next()
        if (this.eat('extends') || this.eat('super')) this.parseType()
        args.push({ name: 'Object', dims: 0 })
      } else {
        args.push(this.parseType())
      }
      if (this.eat(',')) continue
      // ">>" und ">>>" müssen aufgespalten werden
      if (this.at('>')) {
        this.next()
        break
      }
      if (this.at('>>')) {
        this.cur.text = '>'
        break
      }
      if (this.at('>>>')) {
        this.cur.text = '>>'
        break
      }
      this.fail('In der Typangabe fehlt «>».')
    }
    return args
  }

  /** Versucht, an der aktuellen Stelle einen Typ zu lesen; gibt bei Misserfolg null zurück. */
  private tryType(): TypeRef | null {
    const mark = this.save()
    try {
      const t = this.parseType()
      return t
    } catch {
      this.restore(mark)
      return null
    }
  }

  /* --------------------------- Typdeklaration --------------------------- */

  private parseTypeDecl(): ClassDecl {
    const pos = this.pos()
    const modifiers = this.parseModifiers()
    return this.parseTypeDeclBody(modifiers, pos)
  }

  private parseTypeDeclBody(modifiers: Modifier[], pos: { line: number; col: number }): ClassDecl {
    let type: ClassDecl['type']
    if (this.eat('class')) type = 'class'
    else if (this.eat('interface')) type = 'interface'
    else if (this.eat('enum')) type = 'enum'
    else if (this.at('record') && this.peek(1).kind === 'ident') {
      this.next()
      type = 'record'
    } else {
      this.fail(`Hier wird eine Klasse (class), ein Interface oder ein enum erwartet, gefunden wurde «${this.cur.text}».`)
    }

    const name = this.expectIdent('Klassenname')
    if (this.at('<')) this.parseTypeArgs()

    let recordComponents: Param[] | undefined
    if (type === 'record') {
      recordComponents = []
      this.expect('(')
      if (!this.at(')')) {
        do {
          const p = this.pos()
          const t = this.parseType()
          const n = this.expectIdent('Parametername')
          recordComponents.push({ ...p, name: n, type: t, varargs: false })
        } while (this.eat(','))
      }
      this.expect(')')
    }

    let ext: TypeRef | undefined
    const impl: TypeRef[] = []
    if (this.eat('extends')) {
      ext = this.parseType()
      // Interfaces können mehrere Typen erweitern
      while (this.eat(',')) impl.push(this.parseType())
    }
    if (this.eat('implements')) {
      do {
        impl.push(this.parseType())
      } while (this.eat(','))
    }

    const decl: ClassDecl = {
      kind: 'class',
      ...pos,
      name,
      type,
      modifiers,
      extends: ext,
      implements: impl,
      members: [],
      recordComponents,
    }

    this.expect('{', `Der Rumpf von ${name} muss mit { beginnen.`)

    if (type === 'enum') {
      decl.enumConstants = this.parseEnumConstants()
    }

    while (!this.at('}') && !this.atEnd()) {
      if (this.eat(';')) continue
      const m = this.parseMember(name, type)
      if (m) decl.members.push(m)
    }
    this.expect('}', `Der Klasse ${name} fehlt die schließende Klammer }.`)
    return decl
  }

  private parseEnumConstants(): EnumConstant[] {
    const out: EnumConstant[] = []
    while (this.cur.kind === 'ident' || this.at('@')) {
      while (this.at('@')) this.skipAnnotation()
      const pos = this.pos()
      const name = this.expectIdent('Enum-Konstante')
      const args: Expr[] = []
      if (this.at('(')) {
        this.next()
        if (!this.at(')')) {
          do {
            args.push(this.parseExpr())
          } while (this.eat(','))
        }
        this.expect(')')
      }
      if (this.at('{')) this.skipBalanced('{', '}')
      out.push({ ...pos, name, args })
      if (!this.eat(',')) break
    }
    this.eat(';')
    return out
  }

  private parseMember(className: string, containerType: ClassDecl['type']): Member | null {
    const pos = this.pos()
    const modifiers = this.parseModifiers()

    /* Initialisierungsblock */
    if (this.at('{')) {
      const body = this.parseBlock()
      return { kind: 'init', ...pos, static: modifiers.includes('static'), body } as InitBlock
    }

    /* geschachtelte Typen */
    if (this.at('class') || this.at('interface') || this.at('enum') || (this.at('record') && this.peek(1).kind === 'ident')) {
      return this.parseTypeDeclBody(modifiers, pos)
    }

    /* generische Methode: <T> void foo() */
    if (this.at('<')) this.parseTypeArgs()

    /* Konstruktor */
    if (this.cur.kind === 'ident' && this.cur.text === className && this.at('(', 1)) {
      const name = this.next().text
      const params = this.parseParams()
      this.parseThrows()
      const body = this.at('{') ? this.parseBlock() : undefined
      return {
        kind: 'method', ...pos, name, modifiers,
        returnType: { name: 'void', dims: 0 }, params, body, isConstructor: true,
      } as MethodDecl
    }

    const type = this.parseType()

    /* Methode oder Feld */
    const namePos = this.pos()
    const name = this.expectIdent('Name des Feldes oder der Methode')

    if (this.at('(')) {
      const params = this.parseParams()
      let extraDims = 0
      while (this.at('[') && this.at(']', 1)) {
        this.next()
        this.next()
        extraDims++
      }
      this.parseThrows()
      let body: Block | undefined
      if (this.at('{')) body = this.parseBlock()
      else if (this.eat('default')) {
        this.parseExpr()
        this.expect(';')
      } else this.expect(';', `Der Methode ${name} fehlt entweder ein Rumpf { … } oder ein Semikolon.`)

      const isAbstract = !body && containerType !== 'interface'
      void isAbstract
      return {
        kind: 'method', ...pos, name, modifiers,
        returnType: { ...type, dims: type.dims + extraDims }, params, body, isConstructor: false,
      } as MethodDecl
    }

    /* Feld(er) */
    const vars: VarDeclarator[] = []
    let first = true
    for (;;) {
      const vname = first ? name : this.expectIdent('Feldname')
      const vpos = first ? namePos : this.pos()
      first = false
      let extraDims = 0
      while (this.at('[') && this.at(']', 1)) {
        this.next()
        this.next()
        extraDims++
      }
      let init: Expr | undefined
      if (this.eat('=')) init = this.at('{') ? this.parseArrayInit() : this.parseExpr()
      vars.push({ ...vpos, name: vname, extraDims, init })
      if (!this.eat(',')) break
    }
    this.expect(';', 'Nach einer Felddeklaration fehlt das Semikolon.')
    return { kind: 'field', ...pos, modifiers, type, vars } as FieldDecl
  }

  private parseThrows() {
    if (this.eat('throws')) {
      do {
        this.parseType()
      } while (this.eat(','))
    }
  }

  private parseParams(): Param[] {
    this.expect('(')
    const params: Param[] = []
    if (!this.at(')')) {
      do {
        while (this.at('@')) this.skipAnnotation()
        this.eat('final')
        const pos = this.pos()
        const type = this.parseType()
        const varargs = this.eat('...')
        const name = this.expectIdent('Parametername')
        let extraDims = 0
        while (this.at('[') && this.at(']', 1)) {
          this.next()
          this.next()
          extraDims++
        }
        params.push({ ...pos, name, type: { ...type, dims: type.dims + extraDims + (varargs ? 1 : 0) }, varargs })
      } while (this.eat(','))
    }
    this.expect(')', 'Der Parameterliste fehlt die schließende Klammer ).')
    return params
  }

  /* ---------------------------- Anweisungen ---------------------------- */

  parseBlock(): Block {
    const pos = this.pos()
    this.expect('{')
    const stmts: Stmt[] = []
    while (!this.at('}') && !this.atEnd()) stmts.push(this.parseStmt())
    this.expect('}', 'Es fehlt eine schließende geschweifte Klammer }.')
    return { kind: 'block', ...pos, stmts }
  }

  parseStmt(): Stmt {
    const pos = this.pos()

    if (this.at('{')) return this.parseBlock()
    if (this.eat(';')) return { kind: 'empty', ...pos }

    if (this.at('if')) {
      this.next()
      this.expect('(', 'Nach if muss eine Bedingung in runden Klammern stehen.')
      const cond = this.parseExpr()
      this.expect(')')
      const then = this.parseStmt()
      let els: Stmt | undefined
      if (this.eat('else')) els = this.parseStmt()
      return { kind: 'if', ...pos, cond, then, else: els }
    }

    if (this.at('while')) {
      this.next()
      this.expect('(')
      const cond = this.parseExpr()
      this.expect(')')
      const body = this.parseStmt()
      return { kind: 'while', ...pos, cond, body }
    }

    if (this.at('do')) {
      this.next()
      const body = this.parseStmt()
      this.expect('while', 'Nach dem Rumpf einer do-Schleife muss while(…) folgen.')
      this.expect('(')
      const cond = this.parseExpr()
      this.expect(')')
      this.expect(';', 'Die do-while-Schleife endet mit einem Semikolon.')
      return { kind: 'dowhile', ...pos, cond, body }
    }

    if (this.at('for')) return this.parseFor()

    if (this.at('switch')) return this.parseSwitch()

    if (this.at('break')) {
      this.next()
      const label = this.cur.kind === 'ident' ? this.next().text : undefined
      this.expect(';')
      return { kind: 'break', ...pos, label }
    }
    if (this.at('continue')) {
      this.next()
      const label = this.cur.kind === 'ident' ? this.next().text : undefined
      this.expect(';')
      return { kind: 'continue', ...pos, label }
    }
    if (this.at('return')) {
      this.next()
      const value = this.at(';') ? undefined : this.parseExpr()
      this.expect(';', 'Nach return fehlt das Semikolon.')
      return { kind: 'return', ...pos, value }
    }
    if (this.at('throw')) {
      this.next()
      const value = this.parseExpr()
      this.expect(';')
      return { kind: 'throw', ...pos, value }
    }
    if (this.at('try')) return this.parseTry()
    if (this.at('assert')) {
      this.next()
      const cond = this.parseExpr()
      let message: Expr | undefined
      if (this.eat(':')) message = this.parseExpr()
      this.expect(';')
      return { kind: 'assert', ...pos, cond, message }
    }
    if (this.at('synchronized') && this.at('(', 1)) {
      this.next()
      this.expect('(')
      this.parseExpr()
      this.expect(')')
      return this.parseBlock()
    }
    if (this.at('class') || this.at('interface') || this.at('enum') || (this.at('abstract') && this.at('class', 1)) || (this.at('final') && this.at('class', 1))) {
      const mods = this.parseModifiers()
      return { kind: 'localclass', ...pos, decl: this.parseTypeDeclBody(mods, pos) }
    }

    /* markierte Anweisung:  aussen: for(...) */
    if (this.cur.kind === 'ident' && this.at(':', 1)) {
      const label = this.next().text
      this.next()
      return { kind: 'labeled', ...pos, label, body: this.parseStmt() }
    }

    /* lokale Variablendeklaration? */
    const declMark = this.save()
    const isFinal = this.at('final')
    if (isFinal) this.next()
    const type = this.tryType()
    if (type && (this.cur.kind === 'ident' || (this.cur.kind === 'keyword' && ['var', 'record', 'yield'].includes(this.cur.text)))) {
      const afterName = this.peek(1)
      if (['=', ';', ',', '['].includes(afterName.text) || afterName.kind === 'eof') {
        const vars: VarDeclarator[] = []
        do {
          const vpos = this.pos()
          const vname = this.expectIdent('Variablenname')
          let extraDims = 0
          while (this.at('[') && this.at(']', 1)) {
            this.next()
            this.next()
            extraDims++
          }
          let init: Expr | undefined
          if (this.eat('=')) init = this.at('{') ? this.parseArrayInit() : this.parseExpr()
          vars.push({ ...vpos, name: vname, extraDims, init })
        } while (this.eat(','))
        this.expect(';', `Nach der Deklaration von «${vars[0].name}» fehlt ein Semikolon.`)
        return { kind: 'localvar', ...pos, type, vars, isFinal }
      }
    }
    this.restore(declMark)

    const expr = this.parseExpr()
    this.expect(';', 'Jede Anweisung in Java endet mit einem Semikolon.')
    return { kind: 'exprstmt', ...pos, expr }
  }

  private parseFor(): Stmt {
    const pos = this.pos()
    this.expect('for')
    this.expect('(')

    /* for-each?  for (Typ name : ausdruck) */
    const mark = this.save()
    this.eat('final')
    const t = this.tryType()
    if (t && this.cur.kind === 'ident' && this.at(':', 1)) {
      const varName = this.next().text
      this.next()
      const iterable = this.parseExpr()
      this.expect(')')
      const body = this.parseStmt()
      return { kind: 'foreach', ...pos, varType: t, varName, iterable, body }
    }
    this.restore(mark)

    const init: Stmt[] = []
    if (!this.at(';')) {
      const m2 = this.save()
      const isFinal = this.at('final')
      if (isFinal) this.next()
      const type = this.tryType()
      if (type && this.cur.kind === 'ident' && ['=', ';', ',', '['].includes(this.peek(1).text)) {
        const vars: VarDeclarator[] = []
        do {
          const vpos = this.pos()
          const vname = this.expectIdent('Variablenname')
          let extraDims = 0
          while (this.at('[') && this.at(']', 1)) {
            this.next()
            this.next()
            extraDims++
          }
          let vinit: Expr | undefined
          if (this.eat('=')) vinit = this.at('{') ? this.parseArrayInit() : this.parseExpr()
          vars.push({ ...vpos, name: vname, extraDims, init: vinit })
        } while (this.eat(','))
        init.push({ kind: 'localvar', ...pos, type, vars, isFinal })
      } else {
        this.restore(m2)
        do {
          const epos = this.pos()
          init.push({ kind: 'exprstmt', ...epos, expr: this.parseExpr() })
        } while (this.eat(','))
      }
    }
    this.expect(';', 'In der for-Schleife fehlt das erste Semikolon.')
    const cond = this.at(';') ? undefined : this.parseExpr()
    this.expect(';', 'In der for-Schleife fehlt das zweite Semikolon.')
    const update: Expr[] = []
    if (!this.at(')')) {
      do {
        update.push(this.parseExpr())
      } while (this.eat(','))
    }
    this.expect(')')
    const body = this.parseStmt()
    return { kind: 'for', ...pos, init, cond, update, body }
  }

  private parseSwitch(): Stmt {
    const pos = this.pos()
    this.expect('switch')
    this.expect('(')
    const subject = this.parseExpr()
    this.expect(')')
    this.expect('{')
    const cases: SwitchCase[] = []

    while (!this.at('}') && !this.atEnd()) {
      const cpos = this.pos()
      const labels: Expr[] = []
      let isDefault = false
      if (this.eat('default')) {
        isDefault = true
      } else {
        this.expect('case', 'In einem switch sind nur case- und default-Zweige erlaubt.')
        do {
          labels.push(this.parseTernary())
        } while (this.eat(','))
      }

      if (this.eat('->')) {
        // Pfeil-Syntax: genau eine Anweisung oder ein Block, kein Fallthrough
        const stmts: Stmt[] = []
        if (this.at('{')) stmts.push(this.parseBlock())
        else if (this.at('throw')) stmts.push(this.parseStmt())
        else {
          const epos = this.pos()
          const e = this.parseExpr()
          this.expect(';')
          stmts.push({ kind: 'exprstmt', ...epos, expr: e })
        }
        cases.push({ ...cpos, labels, isDefault, stmts, arrow: true })
      } else {
        this.expect(':', 'Nach case fehlt der Doppelpunkt.')
        const stmts: Stmt[] = []
        while (!this.at('case') && !this.at('default') && !this.at('}') && !this.atEnd()) {
          stmts.push(this.parseStmt())
        }
        cases.push({ ...cpos, labels, isDefault, stmts, arrow: false })
      }
    }
    this.expect('}')
    return { kind: 'switch', ...pos, subject, cases }
  }

  private parseTry(): Stmt {
    const pos = this.pos()
    this.expect('try')
    const resources: Stmt[] = []
    if (this.eat('(')) {
      do {
        if (this.at(')')) break
        const rpos = this.pos()
        this.eat('final')
        const type = this.parseType()
        const name = this.expectIdent('Ressourcenname')
        this.expect('=')
        const init = this.parseExpr()
        resources.push({ kind: 'localvar', ...rpos, type, vars: [{ ...rpos, name, extraDims: 0, init }], isFinal: true })
      } while (this.eat(';'))
      this.expect(')')
    }
    const body = this.parseBlock()
    const catches: CatchClause[] = []
    while (this.at('catch')) {
      const cpos = this.pos()
      this.next()
      this.expect('(')
      this.eat('final')
      const types: TypeRef[] = [this.parseType()]
      while (this.eat('|')) types.push(this.parseType())
      const name = this.expectIdent('Name der Ausnahmevariablen')
      this.expect(')')
      catches.push({ ...cpos, types, name, body: this.parseBlock() })
    }
    let fin: Block | undefined
    if (this.eat('finally')) fin = this.parseBlock()
    if (catches.length === 0 && !fin && resources.length === 0) {
      this.fail('Ein try-Block braucht mindestens ein catch oder ein finally.')
    }
    return { kind: 'try', ...pos, resources: resources as never, body, catches, finally: fin }
  }

  /* ----------------------------- Ausdrücke ----------------------------- */

  parseExpr(): Expr {
    return this.parseAssignment()
  }

  private parseAssignment(): Expr {
    const pos = this.pos()
    const left = this.parseTernary()
    const ops = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=']
    if (this.cur.kind === 'op' && ops.includes(this.cur.text)) {
      const op = this.next().text
      const value = this.at('{') ? this.parseArrayInit() : this.parseAssignment()
      if (left.kind !== 'name' && left.kind !== 'field' && left.kind !== 'index') {
        throw new JavaSyntaxError('Links vom = muss eine Variable, ein Feld oder ein Array-Element stehen.', pos.line, pos.col)
      }
      return { kind: 'assign', ...pos, op, target: left, value }
    }
    return left
  }

  private parseTernary(): Expr {
    const pos = this.pos()
    const cond = this.parseBinary(0)
    if (this.eat('?')) {
      const then = this.parseAssignment()
      this.expect(':', 'Beim Fragezeichen-Operator fehlt der Doppelpunkt.')
      const els = this.parseAssignment()
      return { kind: 'ternary', ...pos, cond, then, else: els }
    }
    return cond
  }

  /** Präzedenzstufen von niedrig nach hoch. */
  private static readonly LEVELS: string[][] = [
    ['||'],
    ['&&'],
    ['|'],
    ['^'],
    ['&'],
    ['==', '!='],
    ['<', '>', '<=', '>='],
    ['<<', '>>', '>>>'],
    ['+', '-'],
    ['*', '/', '%'],
  ]

  private parseBinary(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.parseUnary()
    const ops = Parser.LEVELS[level]
    let left = this.parseBinary(level + 1)

    for (;;) {
      // instanceof liegt auf der Vergleichsebene
      if (level === 6 && this.at('instanceof')) {
        const pos = this.pos()
        this.next()
        this.eat('final')
        const type = this.parseType()
        const binding = this.cur.kind === 'ident' ? this.next().text : undefined
        left = { kind: 'instanceof', ...pos, expr: left, type, binding }
        continue
      }
      if (this.cur.kind !== 'op' || !ops.includes(this.cur.text)) break
      // ">" nicht mit Generics verwechseln — hier immer Vergleich, da Typargumente separat geparst werden
      const pos = this.pos()
      const op = this.next().text
      const right = this.parseBinary(level + 1)
      left = { kind: 'binary', ...pos, op, left, right }
    }
    return left
  }

  private parseUnary(): Expr {
    const pos = this.pos()

    if (this.cur.kind === 'op' && ['+', '-', '!', '~'].includes(this.cur.text)) {
      const op = this.next().text as '+' | '-' | '!' | '~'
      return { kind: 'unary', ...pos, op, prefix: true, expr: this.parseUnary() }
    }
    if (this.at('++') || this.at('--')) {
      const op = this.next().text as '++' | '--'
      return { kind: 'unary', ...pos, op, prefix: true, expr: this.parseUnary() }
    }

    /* Typumwandlung: (int) x, (String) o, (int[]) a */
    if (this.at('(')) {
      const mark = this.save()
      this.next()
      const t = this.tryType()
      if (t && this.at(')')) {
        this.next()
        const nextTok = this.cur
        const primitive = PRIMITIVES.has(t.name)
        const looksLikeOperand =
          nextTok.kind === 'ident' ||
          nextTok.kind === 'string' ||
          nextTok.kind === 'char' ||
          nextTok.kind === 'int' ||
          nextTok.kind === 'long' ||
          nextTok.kind === 'double' ||
          nextTok.kind === 'float' ||
          (nextTok.kind === 'keyword' && ['new', 'this', 'super', 'true', 'false', 'null'].includes(nextTok.text)) ||
          (nextTok.kind === 'op' && EXPR_STARTERS.has(nextTok.text))

        // Bei (a) - b darf kein Cast angenommen werden, wenn a keine Primitivtyp ist
        const ambiguous = !primitive && nextTok.kind === 'op' && ['+', '-', '(', '++', '--'].includes(nextTok.text)
        if (looksLikeOperand && !ambiguous && (primitive || t.dims > 0 || /^[A-Z]/.test(t.name))) {
          return { kind: 'cast', ...pos, type: t, expr: this.parseUnary() }
        }
      }
      this.restore(mark)
    }

    return this.parsePostfix()
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary()
    for (;;) {
      const pos = this.pos()
      if (this.at('.')) {
        this.next()
        if (this.at('<')) this.parseTypeArgs()
        if (this.at('new')) {
          // innere Klassen: outer.new Inner() — auf einfaches new abbilden
          this.next()
          const type = this.parseType()
          const args = this.parseArgs()
          e = { kind: 'new', ...pos, type, args }
          continue
        }
        if (this.at('class')) {
          this.next()
          e = { kind: 'classliteral', ...pos, type: { name: 'Object', dims: 0 } }
          continue
        }
        if (this.at('this')) {
          this.next()
          e = { kind: 'this', ...pos }
          continue
        }
        const name = this.expectIdent('Feld- oder Methodenname nach dem Punkt')
        if (this.at('(')) {
          e = { kind: 'call', ...pos, target: e, name, args: this.parseArgs() }
        } else {
          e = { kind: 'field', ...pos, target: e, name }
        }
        continue
      }
      if (this.at('[')) {
        this.next()
        const index = this.parseExpr()
        this.expect(']', 'Beim Array-Zugriff fehlt die schließende eckige Klammer ].')
        e = { kind: 'index', ...pos, target: e, index }
        continue
      }
      if (this.at('++') || this.at('--')) {
        const op = this.next().text as '++' | '--'
        e = { kind: 'unary', ...pos, op, prefix: false, expr: e }
        continue
      }
      if (this.at('::')) {
        // Methodenreferenz — als Lambda mit einem Argument abbilden
        this.next()
        const name = this.at('new') ? (this.next(), 'new') : this.expectIdent('Methodenname')
        const target = e
        e = {
          kind: 'lambda', ...pos, params: ['$x'],
          body: { kind: 'call', ...pos, target, name, args: [{ kind: 'name', ...pos, name: '$x' }] },
        }
        continue
      }
      break
    }
    return e
  }

  private parseArgs(): Expr[] {
    this.expect('(')
    const args: Expr[] = []
    if (!this.at(')')) {
      do {
        args.push(this.parseExpr())
      } while (this.eat(','))
    }
    this.expect(')', 'Beim Methodenaufruf fehlt die schließende Klammer ).')
    return args
  }

  private parseArrayInit(): ArrayInit {
    const pos = this.pos()
    this.expect('{')
    const values: Expr[] = []
    if (!this.at('}')) {
      do {
        if (this.at('}')) break
        values.push(this.at('{') ? this.parseArrayInit() : this.parseExpr())
      } while (this.eat(','))
    }
    this.expect('}')
    return { kind: 'arrayinit', ...pos, values }
  }

  private parsePrimary(): Expr {
    const pos = this.pos()
    const t = this.cur

    switch (t.kind) {
      case 'int':
        this.next()
        return { kind: 'literal', ...pos, type: 'int', value: t.value as number }
      case 'long':
        this.next()
        return { kind: 'literal', ...pos, type: 'long', value: t.value as bigint }
      case 'double':
        this.next()
        return { kind: 'literal', ...pos, type: 'double', value: t.value as number }
      case 'float':
        this.next()
        return { kind: 'literal', ...pos, type: 'float', value: t.value as number }
      case 'char':
        this.next()
        return { kind: 'literal', ...pos, type: 'char', value: t.value as number }
      case 'string':
        this.next()
        return { kind: 'literal', ...pos, type: 'string', value: t.value as string }
    }

    if (this.at('true') || this.at('false')) {
      const v = this.next().text === 'true'
      return { kind: 'literal', ...pos, type: 'boolean', value: v }
    }
    if (this.at('null')) {
      this.next()
      return { kind: 'literal', ...pos, type: 'null', value: null }
    }
    if (this.at('this')) {
      this.next()
      if (this.at('(')) return { kind: 'call', ...pos, target: null, name: 'this', args: this.parseArgs() }
      return { kind: 'this', ...pos }
    }
    if (this.at('super')) {
      this.next()
      if (this.at('(')) return { kind: 'call', ...pos, target: null, name: 'super', args: this.parseArgs() }
      return { kind: 'super', ...pos }
    }

    if (this.at('new')) {
      this.next()
      const base = this.parseTypeNoArrayDims()
      /* Array-Erzeugung */
      if (this.at('[')) {
        const sizes: Expr[] = []
        let extraDims = 0
        while (this.at('[')) {
          this.next()
          if (this.at(']')) {
            this.next()
            extraDims++
          } else {
            if (extraDims > 0) this.fail('Nach einer leeren [] darf keine Größenangabe mehr folgen.')
            sizes.push(this.parseExpr())
            this.expect(']')
          }
        }
        let init: ArrayInit | undefined
        if (this.at('{')) init = this.parseArrayInit()
        return { kind: 'newarray', ...pos, type: base, sizes, extraDims, init }
      }
      if (this.at('{')) {
        return { kind: 'newarray', ...pos, type: base, sizes: [], extraDims: 1, init: this.parseArrayInit() }
      }
      const args = this.parseArgs()
      let body: ClassDecl | undefined
      if (this.at('{')) {
        // anonyme Klasse
        body = this.parseAnonymousBody(base)
      }
      return { kind: 'new', ...pos, type: base, args, body }
    }

    /* geklammerter Ausdruck oder Lambda */
    if (this.at('(')) {
      const mark = this.save()
      // Lambda mit Parameterliste?
      const lambda = this.tryParseLambda()
      if (lambda) return lambda
      this.restore(mark)

      this.next()
      const e = this.parseExpr()
      this.expect(')', 'Es fehlt eine schließende runde Klammer ).')
      return e
    }

    /* primitive Typen als Ausdruck: int.class, int[]::new … (selten) */
    if (t.kind === 'keyword' && PRIMITIVES.has(t.text)) {
      const type = this.parseType()
      if (this.eat('.')) this.expect('class')
      return { kind: 'classliteral', ...pos, type }
    }

    if (t.kind === 'ident' || (t.kind === 'keyword' && ['var', 'record', 'yield'].includes(t.text))) {
      // Lambda mit einem Parameter ohne Klammern:  x -> ...
      if (this.at('->', 1)) {
        const p = this.next().text
        this.next()
        const body = this.at('{') ? this.parseBlock() : this.parseExpr()
        return { kind: 'lambda', ...pos, params: [p], body }
      }
      const name = this.next().text
      if (this.at('(')) return { kind: 'call', ...pos, target: null, name, args: this.parseArgs() }
      return { kind: 'name', ...pos, name }
    }

    this.fail(`Hier wird ein Wert oder eine Variable erwartet, gefunden wurde «${t.text}».`)
  }

  private parseTypeNoArrayDims(): TypeRef {
    let name: string
    if (this.cur.kind === 'keyword' && PRIMITIVES.has(this.cur.text)) name = this.next().text
    else {
      name = this.expectIdent('Typname')
      while (this.at('.') && this.peek(1).kind === 'ident' && /^[A-Z]/.test(this.peek(1).text)) {
        this.next()
        name = this.next().text
      }
    }
    let args: TypeRef[] | undefined
    if (this.at('<')) args = this.parseTypeArgs()
    return { name, dims: 0, args }
  }

  private parseAnonymousBody(base: TypeRef): ClassDecl {
    const pos = this.pos()
    const decl: ClassDecl = {
      kind: 'class', ...pos,
      name: `${base.name}$anon`,
      type: 'class',
      modifiers: [],
      extends: base,
      implements: [],
      members: [],
    }
    this.expect('{')
    while (!this.at('}') && !this.atEnd()) {
      if (this.eat(';')) continue
      const m = this.parseMember(decl.name, 'class')
      if (m) decl.members.push(m)
    }
    this.expect('}')
    return decl
  }

  private tryParseLambda(): Expr | null {
    const mark = this.save()
    const pos = this.pos()
    try {
      this.expect('(')
      const params: string[] = []
      if (!this.at(')')) {
        do {
          this.eat('final')
          const beforeType = this.save()
          const ty = this.tryType()
          if (ty && this.cur.kind === 'ident') params.push(this.next().text)
          else {
            this.restore(beforeType)
            params.push(this.expectIdent('Parametername'))
          }
        } while (this.eat(','))
      }
      this.expect(')')
      if (!this.at('->')) {
        this.restore(mark)
        return null
      }
      this.next()
      const body = this.at('{') ? this.parseBlock() : this.parseExpr()
      return { kind: 'lambda', ...pos, params, body }
    } catch {
      this.restore(mark)
      return null
    }
  }
}

export function parseJava(src: string): CompilationUnit {
  return new Parser(src).parseCompilationUnit()
}
