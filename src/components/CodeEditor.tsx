'use client'

import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { useMemo } from 'react'
import { useIsDark } from './CodeBlock'

/* Die Editor-Farben folgen demselben Schema wie die Codeblöcke,
   damit Anzeige und Eingabe nicht auseinanderfallen. */

const makeHighlight = (dark: boolean) =>
  HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: dark ? '#767c86' : '#8b9099', fontStyle: 'italic' },
    { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: dark ? '#d19bd6' : '#8a3a86' },
    { tag: [t.string, t.special(t.string), t.character], color: dark ? '#84c9a5' : '#1a6b4c' },
    { tag: [t.number, t.bool, t.null], color: dark ? '#e0ac6f' : '#9b5c11' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: dark ? '#8fb8e8' : '#1b4e8a' },
    { tag: [t.className, t.typeName, t.namespace], color: dark ? '#8fb8e8' : '#1b4e8a' },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: dark ? '#a4abb5' : '#5d636d' },
    { tag: [t.definition(t.variableName), t.propertyName], color: dark ? '#dfe1e5' : '#22252b' },
    { tag: t.invalid, color: dark ? '#e9857f' : '#a8272a' },
  ])

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'rgb(var(--ink))', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.62' },
  '.cm-content': { padding: '9px 0', caretColor: 'rgb(var(--ink))' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'rgb(var(--ink))' },
  '&.cm-focused': { outline: 'none' },
  '.cm-placeholder': { color: 'rgb(var(--faint))' },
  '.cm-matchingBracket': { backgroundColor: 'rgb(var(--accent) / 0.16)', outline: 'none' },
})

export function CodeEditor({
  value,
  onChange,
  language = 'python',
  readOnly = false,
  minHeight = '170px',
  maxHeight = '440px',
  placeholder,
  onSubmit,
  onRun,
}: {
  value: string
  onChange: (v: string) => void
  language?: 'python' | 'java'
  readOnly?: boolean
  minHeight?: string
  maxHeight?: string
  placeholder?: string
  onSubmit?: () => void
  onRun?: () => void
}) {
  const dark = useIsDark()

  const extensions = useMemo(() => {
    const ext = [
      language === 'java' ? java() : python(),
      syntaxHighlighting(makeHighlight(dark)),
      baseTheme,
      EditorView.lineWrapping,
    ]
    if (onSubmit || onRun) {
      ext.push(
        EditorView.domEventHandlers({
          keydown(event) {
            const mod = event.metaKey || event.ctrlKey
            if (mod && event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey && onRun) onRun()
              else (onSubmit ?? onRun)?.()
              return true
            }
            return false
          },
        }),
      )
    }
    return ext
  }, [language, dark, onSubmit, onRun])

  return (
    <div
      className="overflow-hidden rounded-md border border-ruleStrong bg-surface transition-colors
                 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20"
      style={{ minHeight }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        theme="none"
        extensions={extensions}
        editable={!readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          autocompletion: false,
          closeBrackets: true,
          bracketMatching: true,
          indentOnInput: true,
          tabSize: 4,
        }}
        style={{ maxHeight, overflow: 'auto' }}
      />
    </div>
  )
}
