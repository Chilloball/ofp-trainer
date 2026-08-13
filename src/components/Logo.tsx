'use client'

import { motion, useReducedMotion } from 'motion/react'

/* ==================================================================== *
 *  Bildmarke
 *
 *  Zwei eckige Klammern — das Zeichen für Quelltext — und dazwischen
 *  eine Treppe aus drei Stufen: der Lernpfad. Die oberste Stufe steht in
 *  Ultramarin, weil sie das Ziel ist: die Klausur.
 *
 *  Das ist bewusst kein rundes Feld mit `{ }` darin. Diese Marke lässt
 *  sich in einer Zeile erklären, und genau das macht sie zu einer Marke
 *  statt zu einem Platzhalter.
 * ==================================================================== */

const STEPS = [
  { x: 8.1, y: 13.3 },
  { x: 10.4, y: 10.4 },
  { x: 12.7, y: 7.5 },
]

export function LogoMark({ size = 24, animate = false }: { size?: number; animate?: boolean }) {
  const still = useReducedMotion()
  const move = animate && !still

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      {/* Klammern */}
      <path
        d="M7.4 3.4H4.3v17.2h3.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="square"
        opacity="0.85"
      />
      <path
        d="M16.6 3.4h3.1v17.2h-3.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="square"
        opacity="0.85"
      />

      {/* Treppe: unten breit gelernt, oben das Ziel */}
      {STEPS.map((s, i) => {
        const last = i === STEPS.length - 1
        return (
          <motion.rect
            key={i}
            x={s.x}
            y={s.y}
            width="3.4"
            height="3.4"
            rx="0.6"
            fill={last ? 'rgb(var(--accent))' : 'currentColor'}
            opacity={last ? 1 : 0.55 + i * 0.15}
            initial={move ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: last ? 1 : 0.55 + i * 0.15 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: 0.12 + i * 0.11 }}
            style={{ transformOrigin: `${s.x + 1.7}px ${s.y + 1.7}px` }}
          />
        )
      })}
    </svg>
  )
}

/**
 * Wortmarke. „OFP" läuft breit (Archivos Breitenachse), „TRAINER" steht
 * gesperrt in Monospace darunter — der typografische Kontrast trägt die
 * Marke, nicht ein Effekt.
 */
export function Wordmark({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark size={26} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-[7px]">
          <span className="numeral text-[17px] leading-none">OFP</span>
          <span className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-muted">
            Trainer
          </span>
        </span>
        {subtitle && (
          <span className="mt-[5px] block font-mono text-[9.5px] uppercase leading-none tracking-[0.14em] text-faint">
            Universität Siegen
          </span>
        )}
      </span>
    </span>
  )
}
