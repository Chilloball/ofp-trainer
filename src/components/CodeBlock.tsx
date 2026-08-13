'use client'

import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { useEffect, useState } from 'react'

/* Eigene Themes, damit der Code zur Papieroptik passt und nicht wie ein
   fremdes Terminal wirkt. Zurückhaltende Farbigkeit, hoher Kontrast. */

const light: PrismTheme = {
  plain: { color: '#22252b', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8b9099', fontStyle: 'italic' } },
    { types: ['keyword', 'builtin', 'boolean'], style: { color: '#8a3a86' } },
    { types: ['string', 'char', 'attr-value'], style: { color: '#1a6b4c' } },
    { types: ['number'], style: { color: '#9b5c11' } },
    { types: ['function', 'class-name'], style: { color: '#1b4e8a' } },
    { types: ['operator', 'punctuation'], style: { color: '#5d636d' } },
    { types: ['tag', 'selector'], style: { color: '#a8272a' } },
    { types: ['variable', 'attr-name'], style: { color: '#22252b' } },
  ],
}

const dark: PrismTheme = {
  plain: { color: '#dfe1e5', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#767c86', fontStyle: 'italic' } },
    { types: ['keyword', 'builtin', 'boolean'], style: { color: '#d19bd6' } },
    { types: ['string', 'char', 'attr-value'], style: { color: '#84c9a5' } },
    { types: ['number'], style: { color: '#e0ac6f' } },
    { types: ['function', 'class-name'], style: { color: '#8fb8e8' } },
    { types: ['operator', 'punctuation'], style: { color: '#a4abb5' } },
    { types: ['tag', 'selector'], style: { color: '#e9857f' } },
    { types: ['variable', 'attr-name'], style: { color: '#dfe1e5' } },
  ],
}

export function useIsDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

export function CodeBlock({
  code,
  language = 'python',
  showLineNumbers = true,
  highlightLines = [],
  caption,
  className = '',
  maxHeight,
}: {
  code: string
  language?: 'python' | 'java' | 'text'
  showLineNumbers?: boolean
  highlightLines?: number[]
  caption?: string
  className?: string
  maxHeight?: number
}) {
  const isDark = useIsDark()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  const body = code.replace(/\n+$/, '')
  const lines = body.split('\n').length

  return (
    <div className={`group relative my-3 overflow-hidden rounded-md border border-rule bg-raised ${className}`}>
      {caption && (
        <div className="flex items-center border-b border-rule px-3 py-1.5">
          <span className="eyebrow">{caption}</span>
          <span className="ml-auto text-[11px] tabnum text-faint">{lines} Zeilen</span>
        </div>
      )}
      <button
        onClick={copy}
        className="absolute right-1.5 top-1.5 z-10 rounded border border-rule bg-surface px-1.5 py-1 text-[11px] text-muted
                   opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100"
        style={caption ? { top: '2.4rem' } : undefined}
        aria-label="Code kopieren"
      >
        {copied ? 'kopiert' : 'kopieren'}
      </button>
      <Highlight
        code={body}
        language={language === 'text' ? 'markup' : language}
        theme={isDark ? dark : light}
      >
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className="overflow-auto px-3 py-2.5 font-mono text-[13px] leading-[1.62]"
            style={{ background: 'transparent', margin: 0, maxHeight }}
          >
            {tokens.map((line, i) => {
              const hl = highlightLines.includes(i + 1)
              return (
                <div
                  key={i}
                  {...getLineProps({ line })}
                  className={`table-row ${hl ? 'bg-oxide/12' : ''}`}
                  style={hl ? { boxShadow: 'inset 2px 0 0 rgb(var(--oxide))' } : undefined}
                >
                  {showLineNumbers && (
                    <span className="table-cell select-none pr-3.5 text-right text-[11px] tabnum text-faint/70">
                      {i + 1}
                    </span>
                  )}
                  <span className="table-cell whitespace-pre-wrap break-words">
                    {line.map((token, k) => (
                      <span key={k} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

/** Konsolenausgabe — bewusst schlicht, damit Fehler auffallen. */
export function Console({
  stdout,
  stderr,
  empty = '(keine Ausgabe)',
  label = 'Ausgabe',
  maxHeight = 260,
}: {
  stdout?: string
  stderr?: string | null
  empty?: string
  label?: string
  maxHeight?: number
}) {
  const hasErr = !!stderr && stderr.trim().length > 0
  return (
    <div className="overflow-hidden rounded-md border border-rule">
      <div className="flex items-center border-b border-rule bg-raised px-3 py-1.5">
        <span className="eyebrow">{label}</span>
        {hasErr && <span className="ml-auto text-[11px] font-medium text-neg">Fehler</span>}
      </div>
      <pre
        className="overflow-auto whitespace-pre-wrap break-words bg-surface px-3 py-2.5 font-mono text-[12.5px] leading-[1.6]"
        style={{ maxHeight }}
      >
        {stdout || (!hasErr ? <span className="text-faint">{empty}</span> : null)}
        {hasErr && <span className="text-neg">{stdout ? '\n' : ''}{stderr}</span>}
      </pre>
    </div>
  )
}
