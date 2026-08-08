'use client'

import { useStore } from '@/lib/store'
import { Segmented } from './ui'

/** Schwerpunkt und Rundenlänge — bewusst klein gehalten, damit die
    Startseite nicht zur Einstellungsseite wird. */
export function PracticeSettings() {
  const { progress, setSetting } = useStore()
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <label className="flex items-center gap-2 text-[13px] text-muted">
        Schwerpunkt
        <Segmented
          size="sm"
          value={progress.settings.focus}
          onChange={(v) => setSetting('focus', v)}
          options={[
            { value: 'balanced', label: 'Beides' },
            { value: 'python', label: 'Python' },
            { value: 'java', label: 'Java' },
            { value: 'weakest', label: 'Lücken' },
          ]}
        />
      </label>
      <label className="flex items-center gap-2 text-[13px] text-muted">
        Rundenlänge
        <Segmented
          size="sm"
          value={String(progress.settings.sessionLength)}
          onChange={(v) => setSetting('sessionLength', Number(v))}
          options={[
            { value: '5', label: '5' },
            { value: '10', label: '10' },
            { value: '20', label: '20' },
          ]}
        />
      </label>
    </div>
  )
}
