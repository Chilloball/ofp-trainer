'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EXAM_DATE } from '@/content/topics'
import { useStore } from '@/lib/store'
import { LogoMark, Wordmark } from './Logo'
import { EASE, useCountdown } from './ui'

const PRIMARY = [
  { href: '/', label: 'Start' },
  { href: '/ueben', label: 'Üben' },
  { href: '/themen', label: 'Themen' },
  { href: '/klausur', label: 'Klausuren' },
  { href: '/compiler', label: 'Compiler' },
]

const SECONDARY = [
  { href: '/fortschritt', label: 'Fortschritt' },
  { href: '/material', label: 'Material' },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [pathname])

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur-sm lg:flex">
        <Link href="/" className="group px-5 pb-6 pt-7">
          <Wordmark />
        </Link>
        <Nav pathname={pathname} />
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/85 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <button onClick={() => setMenu(true)} aria-label="Menü öffnen" className="btn-quiet -ml-1.5 !px-2 !py-1.5">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-display text-[15px] font-semibold tracking-tight">OFP&#8202;Trainer</span>
          </Link>
          <div className="ml-auto">
            <Countdown />
          </div>
        </header>

        <AnimatePresence>
          {menu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] lg:hidden"
                onClick={() => setMenu(false)}
              />
              <motion.aside
                initial={{ x: -270 }}
                animate={{ x: 0 }}
                exit={{ x: -270 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="fixed inset-y-0 left-0 z-50 flex w-[262px] flex-col border-r border-line bg-surface lg:hidden"
              >
                <div className="flex items-center justify-between px-5 pb-5 pt-6">
                  <Wordmark />
                  <button onClick={() => setMenu(false)} aria-label="Schließen" className="btn-quiet !px-2 !py-1.5">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <Nav pathname={pathname} idSuffix="-mobil" />
                <SidebarFooter />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <StorageWarning />

        {/* Seitenwechsel: kurz anheben, damit der Wechsel spürbar ist */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="min-w-0 flex-1"
        >
          {children}
        </motion.main>
      </div>

      <Toasts />
    </div>
  )
}

function Nav({ pathname, idSuffix = '' }: { pathname: string; idSuffix?: string }) {
  return (
    <nav className="flex-1 px-3">
      <ul className="space-y-0.5">
        {PRIMARY.map((item) => (
          <li key={item.href}>
            <NavLink {...item} active={isActive(pathname, item.href)} group={`nav${idSuffix}`} />
          </li>
        ))}
      </ul>
      <div className="my-3.5 border-t border-line" />
      <ul className="space-y-0.5">
        {SECONDARY.map((item) => (
          <li key={item.href}>
            <NavLink {...item} active={isActive(pathname, item.href)} group={`nav2${idSuffix}`} quiet />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function NavLink({
  href,
  label,
  active,
  quiet,
  group,
}: {
  href: string
  label: string
  active: boolean
  quiet?: boolean
  group: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center rounded-lg px-3 py-[7px] transition-colors duration-150
        ${quiet ? 'text-[13px]' : 'text-[14px]'}
        ${active ? 'font-medium text-accent' : quiet ? 'text-faint hover:text-ink' : 'text-muted hover:text-ink'}`}
    >
      {active && (
        <motion.span
          layoutId={group}
          className="absolute inset-0 -z-10 rounded-lg bg-accentWash"
          transition={{ duration: 0.3, ease: EASE }}
        />
      )}
      {/* Messingstrich am aktiven Punkt — kleiner Anker fürs Auge */}
      {active && (
        <motion.span
          layoutId={`${group}-mark`}
          className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-brass"
          transition={{ duration: 0.3, ease: EASE }}
        />
      )}
      {label}
    </Link>
  )
}

function SidebarFooter() {
  const { theme, setTheme, progress, dueCount } = useStore()
  return (
    <div className="space-y-2.5 border-t border-line px-4 py-3.5">
      <Countdown />
      <AnimatePresence>
        {dueCount > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Link href="/ueben?modus=due" className="block text-[12.5px] text-muted transition-colors hover:text-ink">
              <span className="tabnum font-medium text-brass">{dueCount}</span> Aufgaben zur Wiederholung fällig
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn-quiet !px-2 !py-1 text-[12.5px]"
          title="Helles oder dunkles Farbschema"
        >
          {theme === 'dark' ? 'Hell' : 'Dunkel'}
        </button>
        {progress.name && (
          <span className="ml-auto truncate text-[12.5px] text-faint" title={progress.name}>
            {progress.name}
          </span>
        )}
      </div>
    </div>
  )
}

function Countdown() {
  const left = useCountdown(EXAM_DATE)
  if (!left) return null
  const urgent = !left.past && left.d <= 10
  return (
    <div className={`text-[12.5px] ${urgent ? 'text-warn' : 'text-faint'}`} title="Klausurtermin 31.08.2026, 9 Uhr">
      {left.past ? (
        'Klausurtermin vorbei'
      ) : (
        <>
          Klausur in <span className="tabnum font-medium">{left.d}</span> Tagen
        </>
      )}
    </div>
  )
}

function StorageWarning() {
  const { storageError } = useStore()
  if (!storageError) return null
  return (
    <div className="border-b border-warn/30 bg-warnWash px-4 py-2 text-[13px] text-warn">
      {storageError} Sichere deinen Stand unter{' '}
      <Link href="/fortschritt" className="underline">
        Fortschritt
      </Link>
      .
    </div>
  )
}

function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            transition={{ duration: 0.3, ease: EASE }}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-[13.5px] shadow-pop ${
              t.kind === 'ok'
                ? 'border-ok/35 bg-okWash text-ok'
                : t.kind === 'bad'
                  ? 'border-bad/35 bg-badWash text-bad'
                  : 'border-line bg-surface text-ink'
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Einheitlicher Seitenrahmen. */
export function Page({
  title,
  lead,
  actions,
  children,
  wide = false,
}: {
  title: string
  lead?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={`mx-auto w-full px-4 py-8 sm:px-8 sm:py-10 ${wide ? 'max-w-[1220px]' : 'max-w-content'}`}>
      <header className="mb-8 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] leading-[1.15] sm:text-[34px]">{title}</h1>
          {lead && <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
