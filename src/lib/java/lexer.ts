/* ==================================================================== *
 *  Java-Lexer
 *
 *  Zerlegt Quelltext in Token. Kommentare und Whitespace werden
 *  übersprungen, Position (Zeile/Spalte) bleibt für Fehlermeldungen
 *  erhalten.
 * ==================================================================== */

export type TokenKind =
  | 'ident'
  | 'keyword'
  | 'int'
  | 'long'
  | 'double'
  | 'float'
  | 'char'
  | 'string'
  | 'op'
  | 'eof'

export interface Token {
  kind: TokenKind
  text: string
  /** ausgewerteter Wert bei Literalen */
  value?: number | bigint | string
  line: number
  col: number
  pos: number
}

export class JavaSyntaxError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly col: number,
  ) {
    super(message)
    this.name = 'JavaSyntaxError'
  }
}

const KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
  'volatile', 'while', 'true', 'false', 'null', 'var', 'record', 'yield',
])

/* Länger zuerst, damit `>>>=` vor `>>>` vor `>>` vor `>` greift. */
const OPERATORS = [
  '>>>=', '<<=', '>>=', '>>>', '...', '->', '::',
  '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '<<', '>>',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '?', ':', '&', '|', '^',
  '(', ')', '{', '}', '[', ']', ';', ',', '.', '@',
]

function isIdentStart(c: string) {
  return /[A-Za-z_$]/.test(c)
}
function isIdentPart(c: string) {
  return /[A-Za-z0-9_$]/.test(c)
}
function isDigit(c: string) {
  return c >= '0' && c <= '9'
}

/**
 * Phase 1 der Java-Übersetzung: \uXXXX wird im **gesamten** Quelltext
 * ersetzt — auch in Kommentaren. Genau daher rührt der Klassiker, dass
 * ein Zeilenumbruch-Escape in einem //-Kommentar den Kommentar beendet.
 * Ein `\u` zählt nur, wenn davor eine gerade Anzahl Backslashes steht.
 */
export function translateUnicodeEscapes(src: string): string {
  if (!src.includes('\\u')) return src
  let out = ''
  let i = 0
  while (i < src.length) {
    if (src[i] !== '\\') {
      out += src[i++]
      continue
    }
    let slashes = 0
    while (src[i] === '\\') {
      slashes++
      i++
    }
    if (slashes % 2 === 1 && src[i] === 'u') {
      let j = i
      while (src[j] === 'u') j++
      const hex = src.slice(j, j + 4)
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += '\\'.repeat(slashes - 1) + String.fromCharCode(parseInt(hex, 16))
        i = j + 4
        continue
      }
    }
    out += '\\'.repeat(slashes)
  }
  return out
}

export function tokenize(source: string): Token[] {
  const src = translateUnicodeEscapes(source)
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1
  const n = src.length

  const err = (msg: string): never => {
    throw new JavaSyntaxError(msg, line, col)
  }

  const advance = (count = 1) => {
    for (let k = 0; k < count; k++) {
      if (src[i] === '\n') {
        line++
        col = 1
      } else {
        col++
      }
      i++
    }
  }

  const push = (kind: TokenKind, text: string, startLine: number, startCol: number, startPos: number, value?: number | bigint | string) => {
    tokens.push({ kind, text, value, line: startLine, col: startCol, pos: startPos })
  }

  while (i < n) {
    const c = src[i]

    /* --- Whitespace --- */
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f') {
      advance()
      continue
    }

    /* --- Kommentare --- */
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') advance()
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const sl = line
      const sc = col
      advance(2)
      let closed = false
      while (i < n) {
        if (src[i] === '*' && src[i + 1] === '/') {
          advance(2)
          closed = true
          break
        }
        advance()
      }
      if (!closed) throw new JavaSyntaxError('Blockkommentar wurde nie mit */ geschlossen.', sl, sc)
      continue
    }

    const startLine = line
    const startCol = col
    const startPos = i

    /* --- Zahlen --- */
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let text = ''
      let isFloating = false
      let radix = 10

      if (c === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        radix = 16
        text += src[i] + src[i + 1]
        advance(2)
        while (i < n && /[0-9a-fA-F_]/.test(src[i])) {
          text += src[i]
          advance()
        }
      } else if (c === '0' && (src[i + 1] === 'b' || src[i + 1] === 'B')) {
        radix = 2
        text += src[i] + src[i + 1]
        advance(2)
        while (i < n && /[01_]/.test(src[i])) {
          text += src[i]
          advance()
        }
      } else {
        while (i < n && /[0-9_]/.test(src[i])) {
          text += src[i]
          advance()
        }
        if (src[i] === '.' && isDigit(src[i + 1])) {
          isFloating = true
          text += '.'
          advance()
          while (i < n && /[0-9_]/.test(src[i])) {
            text += src[i]
            advance()
          }
        } else if (src[i] === '.' && !isIdentStart(src[i + 1] ?? '')) {
          // "1." ist gültiges double-Literal
          isFloating = true
          text += '.'
          advance()
        }
        if (src[i] === 'e' || src[i] === 'E') {
          isFloating = true
          text += src[i]
          advance()
          if (src[i] === '+' || src[i] === '-') {
            text += src[i]
            advance()
          }
          if (!isDigit(src[i])) err('Nach dem Exponenten fehlt eine Ziffer.')
          while (i < n && isDigit(src[i])) {
            text += src[i]
            advance()
          }
        }
        // Oktal (führende 0) — im Kurs praktisch nie, aber korrekt behandeln
        if (!isFloating && radix === 10 && /^0[0-7]+$/.test(text.replace(/_/g, ''))) radix = 8
      }

      const clean = text.replace(/_/g, '')
      const suffix = src[i]

      if (suffix === 'L' || suffix === 'l') {
        advance()
        const v = radix === 10 ? BigInt(clean) : BigInt(radix === 8 ? `0o${clean.slice(1)}` : clean)
        push('long', text + suffix, startLine, startCol, startPos, BigInt.asIntN(64, v))
        continue
      }
      if (suffix === 'f' || suffix === 'F') {
        advance()
        push('float', text + suffix, startLine, startCol, startPos, Number(clean))
        continue
      }
      if (suffix === 'd' || suffix === 'D') {
        advance()
        push('double', text + suffix, startLine, startCol, startPos, Number(clean))
        continue
      }
      if (isFloating) {
        push('double', text, startLine, startCol, startPos, Number(clean))
        continue
      }

      let intVal: number
      if (radix === 16) intVal = Number(BigInt.asIntN(32, BigInt(clean)))
      else if (radix === 2) intVal = Number(BigInt.asIntN(32, BigInt(clean)))
      else if (radix === 8) intVal = parseInt(clean, 8) | 0
      else {
        const big = BigInt(clean)
        if (big > 2147483648n) {
          err(`Die Zahl ${clean} ist zu groß für den Typ int. Hänge ein L an (${clean}L), um ein long-Literal zu schreiben.`)
        }
        intVal = Number(BigInt.asIntN(32, big))
      }
      push('int', text, startLine, startCol, startPos, intVal)
      continue
    }

    /* --- Zeichen-Literal --- */
    if (c === "'") {
      advance()
      let ch: string
      if (src[i] === '\\') {
        advance()
        ch = readEscape()
      } else if (src[i] === "'") {
        throw new JavaSyntaxError('Leeres Zeichenliteral — ein char braucht genau ein Zeichen.', line, col)
      } else {
        ch = src[i]
        advance()
      }
      if (src[i] !== "'") {
        err("Zeichenliteral wurde nicht mit ' geschlossen. Für Text nutzt man doppelte Anführungszeichen (\"...\").")
      }
      advance()
      push('char', `'${ch}'`, startLine, startCol, startPos, ch.charCodeAt(0))
      continue
    }

    /* --- Text-Block (""" ... """) --- */
    if (c === '"' && src[i + 1] === '"' && src[i + 2] === '"') {
      advance(3)
      while (i < n && src[i] === ' ') advance()
      if (src[i] === '\n') advance()
      let out = ''
      while (i < n && !(src[i] === '"' && src[i + 1] === '"' && src[i + 2] === '"')) {
        if (src[i] === '\\') {
          advance()
          out += readEscape()
        } else {
          out += src[i]
          advance()
        }
      }
      if (i >= n) throw new JavaSyntaxError('Text-Block wurde nicht geschlossen.', startLine, startCol)
      advance(3)
      // gemeinsame Einrückung entfernen
      const lines = out.replace(/\n[ \t]*$/, '\n').split('\n')
      const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length)
      const strip = indents.length ? Math.min(...indents) : 0
      out = lines.map((l) => l.slice(strip)).join('\n').replace(/\n$/, '')
      push('string', '"""…"""', startLine, startCol, startPos, out)
      continue
    }

    /* --- String-Literal --- */
    if (c === '"') {
      advance()
      let out = ''
      while (i < n && src[i] !== '"') {
        if (src[i] === '\n') err('Zeichenkette wurde nicht in derselben Zeile geschlossen — es fehlt ein ".')
        if (src[i] === '\\') {
          advance()
          out += readEscape()
        } else {
          out += src[i]
          advance()
        }
      }
      if (i >= n) throw new JavaSyntaxError('Zeichenkette wurde nicht mit " geschlossen.', startLine, startCol)
      advance()
      push('string', JSON.stringify(out), startLine, startCol, startPos, out)
      continue
    }

    /* --- Bezeichner / Schlüsselwörter --- */
    if (isIdentStart(c)) {
      let text = ''
      while (i < n && isIdentPart(src[i])) {
        text += src[i]
        advance()
      }
      push(KEYWORDS.has(text) ? 'keyword' : 'ident', text, startLine, startCol, startPos)
      continue
    }

    /* --- Operatoren --- */
    const op = OPERATORS.find((o) => src.startsWith(o, i))
    if (op) {
      advance(op.length)
      push('op', op, startLine, startCol, startPos)
      continue
    }

    err(`Unerwartetes Zeichen «${c}».`)
  }

  tokens.push({ kind: 'eof', text: '<Ende der Datei>', line, col, pos: i })
  return tokens

  function readEscape(): string {
    const e = src[i]
    advance()
    switch (e) {
      case 'n': return '\n'
      case 't': return '\t'
      case 'r': return '\r'
      case 'b': return '\b'
      case 'f': return '\f'
      case '0': return '\0'
      case 's': return ' '
      case '\\': return '\\'
      case "'": return "'"
      case '"': return '"'
      case 'u': {
        while (src[i] === 'u') advance()
        const hex = src.slice(i, i + 4)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new JavaSyntaxError('Ungültige \\u-Escape-Sequenz.', line, col)
        advance(4)
        return String.fromCharCode(parseInt(hex, 16))
      }
      default:
        throw new JavaSyntaxError(`Unbekannte Escape-Sequenz «\\${e}».`, line, col)
    }
  }
}
