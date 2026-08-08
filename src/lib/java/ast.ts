/* ==================================================================== *
 *  Abstrakter Syntaxbaum
 * ==================================================================== */

export interface Pos {
  line: number
  col: number
}

/** Typangabe: `int`, `String`, `int[][]`, `List<String>` … */
export interface TypeRef {
  name: string
  /** Anzahl der Array-Dimensionen */
  dims: number
  /** Typargumente werden geparst, aber (wie in Java zur Laufzeit) gelöscht */
  args?: TypeRef[]
}

export type Modifier =
  | 'public' | 'private' | 'protected' | 'static' | 'final' | 'abstract'
  | 'synchronized' | 'native' | 'transient' | 'volatile' | 'strictfp' | 'default'

/* ------------------------------ Ausdrücke ------------------------------ */

export type Expr =
  | Literal
  | NameExpr
  | ThisExpr
  | SuperExpr
  | Unary
  | Binary
  | Assign
  | Ternary
  | Call
  | FieldAccess
  | IndexAccess
  | NewObject
  | NewArray
  | Cast
  | InstanceOf
  | ArrayInit
  | Lambda
  | ClassLiteral

export interface Literal extends Pos {
  kind: 'literal'
  type: 'int' | 'long' | 'double' | 'float' | 'char' | 'boolean' | 'string' | 'null'
  value: number | bigint | string | boolean | null
}

export interface NameExpr extends Pos {
  kind: 'name'
  name: string
}

export interface ThisExpr extends Pos {
  kind: 'this'
}

export interface SuperExpr extends Pos {
  kind: 'super'
}

export interface Unary extends Pos {
  kind: 'unary'
  op: '+' | '-' | '!' | '~' | '++' | '--'
  prefix: boolean
  expr: Expr
}

export interface Binary extends Pos {
  kind: 'binary'
  op: string
  left: Expr
  right: Expr
}

export interface Assign extends Pos {
  kind: 'assign'
  op: string // '=', '+=' …
  target: Expr
  value: Expr
}

export interface Ternary extends Pos {
  kind: 'ternary'
  cond: Expr
  then: Expr
  else: Expr
}

export interface Call extends Pos {
  kind: 'call'
  /** null → unqualifizierter Aufruf im aktuellen Objekt/Klasse */
  target: Expr | null
  name: string
  args: Expr[]
}

export interface FieldAccess extends Pos {
  kind: 'field'
  target: Expr
  name: string
}

export interface IndexAccess extends Pos {
  kind: 'index'
  target: Expr
  index: Expr
}

export interface NewObject extends Pos {
  kind: 'new'
  type: TypeRef
  args: Expr[]
  /** anonyme Klasse (nur rudimentär unterstützt) */
  body?: ClassDecl
}

export interface NewArray extends Pos {
  kind: 'newarray'
  type: TypeRef
  /** angegebene Dimensionen (`new int[3][4]` → [3,4]) */
  sizes: Expr[]
  extraDims: number
  init?: ArrayInit
}

export interface ArrayInit extends Pos {
  kind: 'arrayinit'
  values: Expr[]
}

export interface Cast extends Pos {
  kind: 'cast'
  type: TypeRef
  expr: Expr
}

export interface InstanceOf extends Pos {
  kind: 'instanceof'
  expr: Expr
  type: TypeRef
  /** Pattern-Variable bei `x instanceof Foo f` */
  binding?: string
}

export interface Lambda extends Pos {
  kind: 'lambda'
  params: string[]
  body: Expr | Block
}

export interface ClassLiteral extends Pos {
  kind: 'classliteral'
  type: TypeRef
}

/* ----------------------------- Anweisungen ----------------------------- */

export type Stmt =
  | Block
  | LocalVarDecl
  | ExprStmt
  | IfStmt
  | WhileStmt
  | DoWhileStmt
  | ForStmt
  | ForEachStmt
  | SwitchStmt
  | BreakStmt
  | ContinueStmt
  | ReturnStmt
  | ThrowStmt
  | TryStmt
  | EmptyStmt
  | LabeledStmt
  | LocalClassStmt
  | AssertStmt

export interface Block extends Pos {
  kind: 'block'
  stmts: Stmt[]
}

export interface VarDeclarator extends Pos {
  name: string
  extraDims: number
  init?: Expr
}

export interface LocalVarDecl extends Pos {
  kind: 'localvar'
  type: TypeRef
  vars: VarDeclarator[]
  isFinal: boolean
}

export interface ExprStmt extends Pos {
  kind: 'exprstmt'
  expr: Expr
}

export interface IfStmt extends Pos {
  kind: 'if'
  cond: Expr
  then: Stmt
  else?: Stmt
}

export interface WhileStmt extends Pos {
  kind: 'while'
  cond: Expr
  body: Stmt
}

export interface DoWhileStmt extends Pos {
  kind: 'dowhile'
  cond: Expr
  body: Stmt
}

export interface ForStmt extends Pos {
  kind: 'for'
  init: Stmt[]
  cond?: Expr
  update: Expr[]
  body: Stmt
}

export interface ForEachStmt extends Pos {
  kind: 'foreach'
  varType: TypeRef
  varName: string
  iterable: Expr
  body: Stmt
}

export interface SwitchCase extends Pos {
  /** leer → default */
  labels: Expr[]
  isDefault: boolean
  stmts: Stmt[]
  /** true bei `case X ->` (kein Fallthrough) */
  arrow: boolean
  arrowExpr?: Expr
}

export interface SwitchStmt extends Pos {
  kind: 'switch'
  subject: Expr
  cases: SwitchCase[]
}

export interface BreakStmt extends Pos {
  kind: 'break'
  label?: string
}

export interface ContinueStmt extends Pos {
  kind: 'continue'
  label?: string
}

export interface ReturnStmt extends Pos {
  kind: 'return'
  value?: Expr
}

export interface ThrowStmt extends Pos {
  kind: 'throw'
  value: Expr
}

export interface CatchClause extends Pos {
  types: TypeRef[]
  name: string
  body: Block
}

export interface TryStmt extends Pos {
  kind: 'try'
  resources: LocalVarDecl[]
  body: Block
  catches: CatchClause[]
  finally?: Block
}

export interface EmptyStmt extends Pos {
  kind: 'empty'
}

export interface LabeledStmt extends Pos {
  kind: 'labeled'
  label: string
  body: Stmt
}

export interface LocalClassStmt extends Pos {
  kind: 'localclass'
  decl: ClassDecl
}

export interface AssertStmt extends Pos {
  kind: 'assert'
  cond: Expr
  message?: Expr
}

/* ---------------------------- Deklarationen ---------------------------- */

export interface Param extends Pos {
  name: string
  type: TypeRef
  varargs: boolean
}

export interface MethodDecl extends Pos {
  kind: 'method'
  name: string
  modifiers: Modifier[]
  returnType: TypeRef
  params: Param[]
  body?: Block
  isConstructor: boolean
}

export interface FieldDecl extends Pos {
  kind: 'field'
  modifiers: Modifier[]
  type: TypeRef
  vars: VarDeclarator[]
}

export interface InitBlock extends Pos {
  kind: 'init'
  static: boolean
  body: Block
}

export type Member = MethodDecl | FieldDecl | InitBlock | ClassDecl

export interface EnumConstant extends Pos {
  name: string
  args: Expr[]
}

export interface ClassDecl extends Pos {
  kind: 'class'
  name: string
  type: 'class' | 'interface' | 'enum' | 'record'
  modifiers: Modifier[]
  extends?: TypeRef
  implements: TypeRef[]
  members: Member[]
  enumConstants?: EnumConstant[]
  recordComponents?: Param[]
}

export interface CompilationUnit {
  packageName?: string
  imports: string[]
  types: ClassDecl[]
}
