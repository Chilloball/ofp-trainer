'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { EXAM_DATE } from '@/content/topics'
import { useStore } from '@/lib/store'
import { LogoMark, Wordmark } from './Logo'
import { useCountdown } from './ui'

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
      <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/" className="px-5 pb-5 pt-6">
          <Wordmark />
        </Link>
        <Nav pathname={pathname} />
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenu(true)}
            aria-label="Menü öffnen"
            className="btn-quiet -ml-1.5 !px-2 !py-1.5"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-[14px] font-semibold tracking-tight">OFP&#8202;Trainer</span>
          </Link>
          <div className="ml-auto">
            <Countdown />
          </div>
        </header>

        {menu && (
          <>
            <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setMenu(false)} />
            <aside className="enter fixed inset-y-0 left-0 z-50 flex w-[254px] flex-col border-r border-line bg-surface lg:hidden">
              <div className="flex items-center justify-between px-5 pb-4 pt-5">
                <Wordmark />
                <button onClick={() => setMenu(false)} aria-label="Schließen" className="btn-quiet !px-2 !py-1.5">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <Nav pathname={pathname} />
              <SidebarFooter />
            </aside>
          </>
        )}

        <StorageWarning />
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Toasts />
    </div>
  )
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 px-3">
      <ul className="space-y-px">
        {PRIMARY.map((item) => (
          <li key={item.href}>
            <NavLink {...item} active={isActive(pathname, item.href)} />
          </li>
        ))}
      </ul>
      <div className="my-3 border-t border-line" />
      <ul className="space-y-px">
        {SECONDARY.map((item) => (
          <li key={item.href}>
            <NavLink {...item} active={isActive(pathname, item.href)} quiet />
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
}: {
  href: string
  label: string
  active: boolean
  quiet?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center rounded-md px-3 py-[7px] transition-colors
        ${quiet ? 'text-[13px]' : 'text-[14px]'}
        ${
          active
            ? 'bg-accentWash font-medium text-accent'
            : quiet
              ? 'text-faint hover:bg-sunken hover:text-ink'
              : 'text-muted hover:bg-sunken hover:text-ink'
        }`}
    >
      {label}
    </Link>
  )
}

function SidebarFooter() {
  const { theme, setTheme, progress, dueCount } = useStore()
  return (
    <div className="space-y-2.5 border-t border-line px-4 py-3.5">
      <Countdown />
      {dueCount > 0 && (
        <Link href="/ueben?modus=due" className="block text-[12.5px] text-muted hover:text-ink">
          <span className="tabnum font-medium text-ink">{dueCount}</span> Aufgaben zur Wiederholung fällig
        </Link>
      )}
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
    <div
      className={`tabnum text-[12.5px] ${urgent ? 'text-warn' : 'text-faint'}`}
      title="Klausurtermin 31.08.2026, 9 Uhr"
    >
      {left.past ? (
        'Klausurtermin vorbei'
      ) : (
        <>
          Klausur in <span className="font-medium">{left.d} Tagen</span>
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
      {storageError} Sichere deinen Stand unter <Link href="/fortschritt" className="underline">Fortschritt</Link>.
    </div>
  )
}

function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(94vw,420px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`enter pointer-events-auto rounded-md border px-3.5 py-2.5 text-[13.5px] shadow-pop ${
            t.kind === 'ok'
              ? 'border-ok/35 bg-okWash text-ok'
              : t.kind === 'bad'
                ? 'border-bad/35 bg-badWash text-bad'
                : 'border-line bg-surface text-ink'
          }`}
        >
          {t.msg}
        </div>
      ))}
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
    <div className={`mx-auto w-full px-4 py-7 sm:px-7 sm:py-9 ${wide ? 'max-w-[1180px]' : 'max-w-content'}`}>
      <div className="mb-7 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[25px] font-semibold tracking-[-0.02em]">{title}</h1>
          {lead && <p className="mt-1.5 max-w-prose text-[14.5px] text-muted">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
