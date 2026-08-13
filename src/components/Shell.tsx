'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { EXAM_DATE } from '@/content/topics'
import { useStore } from '@/lib/store'
import { LogoMark, Wordmark } from './Logo'
import { EASE, useCountdown } from './ui'

/* ==================================================================== *
 *  Rahmen der Anwendung
 *
 *  Die Navigation ist in drei Gruppen geteilt, weil die acht Seiten
 *  drei verschiedene Fragen beantworten: Was lerne ich? Wie stehe ich
 *  in der Prüfung? Wo liegen meine Sachen? Eine flache Liste aus acht
 *  gleichwertigen Punkten zwingt zum Lesen aller acht.
 *
 *  Unten steht der Klausurzähler. Er ist der einzige Punkt der
 *  Oberfläche, der immer sichtbar bleibt — und der einzige Grund,
 *  warum diese App existiert.
 * ==================================================================== */

interface NavItem {
  href: string
  label: string
  hint?: string
}

const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [{ href: '/', label: 'Start', hint: 'Was heute ansteht' }],
  },
  {
    group: 'Lernen',
    items: [
      { href: '/plan', label: 'Lernplan', hint: 'Der Weg bis zur Klausur' },
      { href: '/ueben', label: 'Üben', hint: 'Aufgabenrunde' },
      { href: '/themen', label: 'Themen', hint: 'Theorie und Aufgaben je Kapitel' },
    ],
  },
  {
    group: 'Prüfen',
    items: [
      { href: '/klausur', label: 'Klausuren', hint: 'Unter Zeitdruck' },
      { href: '/compiler', label: 'Compiler', hint: 'Java und Python ausführen' },
    ],
  },
  {
    group: 'Ablage',
    items: [
      { href: '/fortschritt', label: 'Fortschritt', hint: 'Zahlen und Sicherung' },
      { href: '/material', label: 'Material', hint: 'Folien, Skript, Altklausuren' },
    ],
  },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isNew, ready } = useStore()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [pathname])

  /* Beim allerersten Besuch bekommt das Onboarding den Bildschirm für
     sich. Eine Navigation zu acht Seiten, von denen man noch keine
     kennt, ist an dieser Stelle nur Lärm. */
  if (ready && isNew && pathname === '/') {
    return (
      <main id="inhalt" className="min-h-screen">
        {children}
        <Toasts />
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Wer mit der Tastatur navigiert, soll nicht durch acht
          Navigationspunkte tabben müssen, um zum Inhalt zu kommen. */}
      <a
        href="#inhalt"
        className="sr-only fixed left-3 top-3 z-[70] rounded-md border border-accent bg-surface px-4 py-2 text-[13.5px] font-medium text-accent focus:not-sr-only"
      >
        Zum Inhalt springen
      </a>

      <aside className="sticky top-0 hidden h-screen w-rail shrink-0 flex-col border-r border-rule bg-surface lg:flex">
        <Link href="/" className="block px-5 pb-5 pt-6" aria-label="Zur Startseite">
          <Wordmark />
        </Link>
        <Nav pathname={pathname} />
        <ExamBlock />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-canvas/90 px-4 py-2.5 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setMenu(true)}
            aria-label="Menü öffnen"
            className="btn-quiet -ml-1.5 !px-2 !py-1.5"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 text-ink">
            <LogoMark size={22} />
            <span className="numeral text-[15px]">OFP</span>
          </Link>
          <div className="ml-auto">
            <CountdownChip />
          </div>
        </header>

        <AnimatePresence>
          {menu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-40 bg-ink/45 lg:hidden"
                onClick={() => setMenu(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-rule bg-surface lg:hidden"
              >
                <div className="flex items-start justify-between px-5 pb-4 pt-6">
                  <Wordmark />
                  <button onClick={() => setMenu(false)} aria-label="Schließen" className="btn-quiet !px-2 !py-1.5">
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <Nav pathname={pathname} idSuffix="-mobil" />
                <ExamBlock />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <StorageWarning />

        {/* Seitenwechsel blendet nur über — kein Versatz. Ein von unten
            einfahrender Seiteninhalt sagt nichts und kostet Zeit. */}
        <motion.main
          id="inhalt"
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'linear' }}
          className="min-w-0 flex-1"
        >
          {children}
        </motion.main>
      </div>

      <Toasts />
    </div>
  )
}

/* ------------------------------ Navigation ------------------------------ */

function Nav({ pathname, idSuffix = '' }: { pathname: string; idSuffix?: string }) {
  const { dueCount } = useStore()

  return (
    <nav aria-label="Hauptnavigation" className="flex-1 overflow-y-auto px-3 pb-4">
      {NAV.map((section, gi) => (
        <div key={gi} className={gi === 0 ? '' : 'mt-5'}>
          {section.group && (
            <div className="mb-1.5 flex items-center gap-2 px-3">
              <span className="eyebrow">{section.group}</span>
              <span className="h-px flex-1 bg-rule" />
            </div>
          )}
          <ul>
            {section.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  {...item}
                  active={isActive(pathname, item.href)}
                  group={`nav${idSuffix}`}
                  badge={item.href === '/ueben' && dueCount > 0 ? dueCount : undefined}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function NavLink({
  href,
  label,
  hint,
  active,
  group,
  badge,
}: NavItem & { active: boolean; group: string; badge?: number }) {
  return (
    <Link
      href={href}
      title={hint}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-2 rounded-md px-3 py-[7px] text-[13.5px] transition-colors duration-150
        ${active ? 'font-medium text-ink' : 'text-muted hover:bg-raised hover:text-ink'}`}
    >
      {active && (
        <>
          <motion.span
            layoutId={group}
            className="absolute inset-0 -z-10 rounded-md bg-raised"
            transition={{ duration: 0.24, ease: EASE }}
          />
          {/* Ultramarinstrich als Anker fürs Auge — er gleitet mit. */}
          <motion.span
            layoutId={`${group}-bar`}
            className="absolute left-0 top-1/2 h-[15px] w-[2px] -translate-y-1/2 rounded-full bg-accent"
            transition={{ duration: 0.24, ease: EASE }}
          />
        </>
      )}
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <span
          className="ml-auto shrink-0 rounded-sm bg-accent/12 px-1.5 py-[1px] font-mono text-[10.5px] font-medium tabular-nums text-accent"
          title={`${badge} Aufgaben zur Wiederholung fällig`}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

/* ---------------------------- Klausurzähler ---------------------------- */

/**
 * Der Klausurzähler ist der einzige Teil der Oberfläche, der auf jeder
 * Seite sichtbar bleibt — und der einzige Grund, warum es diese App
 * gibt. Darunter steht der Kursfortschritt, weil „noch 22 Tage" allein
 * keine Handlung nahelegt, „7 von 20 Lektionen" dagegen schon.
 */
function ExamBlock() {
  const left = useCountdown(EXAM_DATE)
  const { progress, theme, setTheme, plan } = useStore()

  const total = plan?.lessons.length ?? 20
  const passed = plan?.passed ?? 0
  const share = total > 0 ? passed / total : 0

  return (
    <div className="border-t border-rule px-5 py-4">
      <div className="eyebrow">Klausur</div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="numeral text-[30px] leading-none tabular-nums">
          {left ? (left.past ? '—' : `T−${left.d}`) : 'T−'}
        </span>
        {left && !left.past && left.d <= 10 && (
          <span className="tag tag-warn" title="Weniger als zehn Tage">
            Endspurt
          </span>
        )}
      </div>

      <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
        Mo 31.08.2026 · 9:00
      </div>

      <Link
        href="/plan"
        className="mt-3.5 block"
        title={`${passed} von ${total} Lektionen sitzen — zum Lernplan`}
      >
        <div className="meter">
          <span className={share >= 1 ? 'bg-pos' : 'bg-accent'} style={{ width: `${share * 100}%` }} />
        </div>
        <div className="mt-1.5 font-mono text-[10px] tabular-nums text-faint transition-colors hover:text-muted">
          {passed} von {total} Lektionen
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2 border-t border-rule pt-3">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn-quiet !px-1.5 !py-1"
          aria-label={theme === 'dark' ? 'Auf helles Farbschema wechseln' : 'Auf dunkles Farbschema wechseln'}
          title={theme === 'dark' ? 'Hell' : 'Dunkel'}
        >
          {theme === 'dark' ? (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="3.6" />
              <path d="M10 2v1.8M10 16.2V18M18 10h-1.8M3.8 10H2M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3M15.7 15.7l-1.3-1.3M5.6 5.6 4.3 4.3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {progress.name && (
          <span className="ml-auto truncate font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint" title={progress.name}>
            {progress.name}
          </span>
        )}
      </div>
    </div>
  )
}

function CountdownChip() {
  const left = useCountdown(EXAM_DATE)
  if (!left) return null
  return (
    <span
      className={`tag ${!left.past && left.d <= 10 ? 'tag-warn' : ''}`}
      title="Klausurtermin 31.08.2026, 9 Uhr"
    >
      {left.past ? 'vorbei' : `T−${left.d}`}
    </span>
  )
}

/* ------------------------------- Hinweise ------------------------------- */

function StorageWarning() {
  const { storageError } = useStore()
  if (!storageError) return null
  return (
    <div className="border-b border-oxide/30 bg-oxideSoft px-4 py-2 text-[13px] text-oxide">
      {storageError} Sichere deinen Stand unter{' '}
      <Link href="/fortschritt" className="underline underline-offset-2">
        Fortschritt
      </Link>
      .
    </div>
  )
}

function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(94vw,400px)] -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:translate-x-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: EASE }}
            role="status"
            className={`pointer-events-auto rounded-md border bg-surface px-4 py-2.5 text-[13.5px] shadow-float ${
              t.kind === 'ok'
                ? 'border-pos/40 text-pos'
                : t.kind === 'bad'
                  ? 'border-neg/40 text-neg'
                  : 'border-rule text-ink'
            }`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ---------------------------- Seitenrahmen ---------------------------- */

/**
 * Einheitlicher Kopf für alle Seiten: Rubrik, Titel, ein Satz Erklärung,
 * Aktionen rechts, darunter eine Kennzeilenreihe in Monospace. Die
 * Trennlinie darunter ist überall gleich — daran erkennt man beim
 * Blättern sofort, dass man in derselben Anwendung ist.
 */
export function Page({
  eyebrow,
  title,
  lead,
  actions,
  meta,
  children,
  width = 'content',
}: {
  eyebrow?: string
  title: string
  lead?: React.ReactNode
  actions?: React.ReactNode
  meta?: { label: string; value: React.ReactNode }[]
  children: React.ReactNode
  width?: 'content' | 'wide' | 'prose'
}) {
  const max = width === 'wide' ? 'max-w-wide' : width === 'prose' ? 'max-w-[860px]' : 'max-w-content'
  return (
    <div className={`mx-auto w-full px-4 py-8 sm:px-8 sm:py-11 ${max}`}>
      <header className="mb-8 border-b border-rule pb-6">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
            <h1 className="text-[31px] leading-[1.1] sm:text-[37px]">{title}</h1>
            {lead && <p className="pretty mt-3 max-w-prose text-[15px] leading-relaxed text-muted">{lead}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {meta && meta.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="eyebrow">{m.label}</dt>
                <dd className="mt-1.5 font-mono text-[13px] tabular-nums text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      {children}
    </div>
  )
}
