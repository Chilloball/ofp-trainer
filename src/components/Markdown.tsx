'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { Mermaid } from './Mermaid'

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-ofp ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
              <div className="my-4 overflow-x-auto rounded-xl border border-line">
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
