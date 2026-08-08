'use client'

import { useEffect, useId, useRef, useState } from 'react'

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default)
  }
  return mermaidPromise
}

export function Mermaid({ chart, className = '' }: { chart: string; className?: string }) {
  const id = useId().replace(/[:]/g, '_')
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = await getMermaid()
        const dark = document.documentElement.classList.contains('dark')
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
          themeVariables: dark
            ? { primaryColor: '#1a1e2c', primaryTextColor: '#e9ecf4', lineColor: '#5b58ff', background: 'transparent' }
            : { primaryColor: '#f4f5f9', primaryTextColor: '#11141d', lineColor: '#5b58ff', background: 'transparent' },
        })
        const { svg } = await mermaid.render(`m${id}`, chart.trim())
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error)?.message ?? e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chart, id])

  if (error) {
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-warn/40 bg-warn/8 p-3 font-mono text-xs text-muted">
        {chart}
      </pre>
    )
  }

  return (
    <div
      ref={ref}
      className={`my-4 flex justify-center overflow-x-auto rounded-xl border border-line bg-surface2 p-4 ${className}`}
    />
  )
}
