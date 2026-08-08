'use client'

import { motion, useReducedMotion } from 'motion/react'

/* ==================================================================== *
 *  OFP-Logo
 *
 *  Die Marke bringt beide Hälften des Fachs zusammen: die geschweiften
 *  Klammern der objektorientierten Welt und das Lambda der funktionalen.
 *  Beim ersten Erscheinen zeichnet sich das Zeichen — als kleine
 *  Erinnerung daran, dass hier etwas gebaut wird.
 * ==================================================================== */

export function LogoMark({ size = 30, className = '', animate = false }: { size?: number; className?: string; animate?: boolean }) {
  const still = useReducedMotion()
  const draw = animate && !still

  const stroke = {
    stroke: 'rgb(var(--paper))',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="OFP">
      <rect width="32" height="32" rx="8" fill="rgb(var(--ink))" />
      <motion.path
        d="M11.6 7.4c-2.1 0-2.2 1.6-2.2 3.4 0 2.5-1.6 5.2-1.6 5.2s1.6 2.7 1.6 5.2c0 1.8.1 3.4 2.2 3.4"
        {...stroke}
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      />
      <motion.path
        d="M20.4 7.4c2.1 0 2.2 1.6 2.2 3.4 0 2.5 1.6 5.2 1.6 5.2s-1.6 2.7-1.6 5.2c0 1.8-.1 3.4-2.2 3.4"
        {...stroke}
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      />
      <motion.path
        d="M13.15 10.1 18.9 21.9"
        {...stroke}
        stroke="rgb(var(--brass))"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut', delay: 0.35 }}
      />
      <motion.path
        d="M16.35 16.55 13.6 21.9"
        {...stroke}
        stroke="rgb(var(--brass))"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeInOut', delay: 0.6 }}
      />
    </svg>
  )
}

export function Wordmark({ compact = false, animate = false }: { compact?: boolean; animate?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 26 : 32} animate={animate} />
      <span className="leading-none">
        <span className="block font-display text-[16px] font-semibold tracking-[-0.01em]">OFP&#8202;Trainer</span>
        {!compact && (
          <span className="mt-[4px] block text-[10px] font-medium uppercase tracking-[0.13em] text-faint">
            Universität Siegen
          </span>
        )}
      </span>
    </span>
  )
}
