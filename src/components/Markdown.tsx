'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { Mermaid } from './Mermaid'

/**
 * Sprungmarke aus einer Überschrift. Muss zeichengleich zu dem sein, was
 * `headings()` erzeugt — sonst zeigt das Inhaltsverzeichnis ins Leere.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Überschriften der Ebenen 2 und 3 aus einem Markdown-Text. */
export function headings(md: string): { level: 2 | 3; text: string; id: string }[] {
  const out: { level: 2 | 3; text: string; id: string }[] = []
  let inFence = false
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!m) continue
    const text = m[2].replace(/[`*_]/g, '').trim()
    out.push({ level: m[1].length as 2 | 3, text, id: slug(text) })
  }
  return out
}

function childText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return childText((children as { props: { children?: React.ReactNode } }).props?.children)
  }
  return ''
}

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-ofp ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* Überschriften bekommen Sprungmarken, damit das
             Inhaltsverzeichnis und geteilte Links funktionieren. */
          h2({ children }) {
            return <h2 id={slug(childText(children))}>{children}</h2>
          },
          h3({ children }) {
            return <h3 id={slug(childText(children))}>{children}</h3>
          },
          code({ className, children, ...props }) {
            const text = String(children).replace(/\n$/, '')
            const match = /language-(\w+)/.exec(className || '')
            const inline = !className && !text.includes('\n')
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            const lang = match?.[1] ?? ''
            if (lang === 'mermaid') return <Mermaid chart={text} />
            return <CodeBlock code={text} language={normalizeLang(lang)} />
          },
          pre({ children }) {
            return <>{children}</>
          },
          a({ href, children }) {
            const external = href?.startsWith('http')
            return (
              <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div className="my-5 overflow-x-auto rounded-md border border-rule">
                <table className="!my-0 !border-0">{children}</table>
              </div>
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

function normalizeLang(l: string): 'python' | 'java' | 'text' {
  const x = l.toLowerCase()
  if (x === 'py' || x === 'python') return 'python'
  if (x === 'java') return 'java'
  return 'text'
}
