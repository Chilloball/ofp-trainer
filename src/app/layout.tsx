import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StoreProvider } from '@/lib/store'
import { Shell } from '@/components/Shell'
import { asset } from '@/lib/paths'

export const metadata: Metadata = {
  title: 'OFP Trainer — Klausurvorbereitung Universität Siegen',
  description:
    'Lernplattform für die Klausur „Objektorientierte und Funktionale Programmierung": Aufgabenbank, Probeklausuren, Lernstandsanalyse und ein Python- und Java-Compiler direkt im Browser.',
  applicationName: 'OFP Trainer',
  icons: {
    icon: [{ url: asset('/icon.svg'), type: 'image/svg+xml' }],
    apple: asset('/icon.svg'),
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f1114' },
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/* Verhindert ein helles Aufblitzen, bevor React das gespeicherte Schema kennt. */
const THEME_BOOT = `(function(){try{
  var raw = localStorage.getItem('ofp-trainer:progress');
  var t = raw ? (JSON.parse(raw).settings||{}).theme : 'system';
  var dark = t === 'dark' || ((!t || t === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
  var e = document.documentElement;
  e.classList.toggle('dark', !!dark);
  e.style.colorScheme = dark ? 'dark' : 'light';
}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <StoreProvider>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  )
}
