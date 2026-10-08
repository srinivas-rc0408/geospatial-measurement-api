import { Check, Copy } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'

import { Icon } from './Icon'

const FEEDBACK_MS = 2000

type CopyState = 'idle' | 'copied' | 'failed'
const labels: Record<CopyState, string> = { idle: 'Copy', copied: 'Copied', failed: 'Copy failed' }

type CodeBlockProps = {
  code: string
  /** Names the snippet for screen readers, e.g. "curl upload command". */
  label: string
}

/** Monospace snippet with a copy button; the button label changes to "Copied" and is announced. */
export function CodeBlock({ code, label }: CodeBlockProps) {
  const [state, setState] = useState<CopyState>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = window.setTimeout(() => {
      setState('idle')
    }, FEEDBACK_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed') // clipboard blocked (insecure context or permission denied)
    }
  }

  return (
    <figure aria-label={label} className="flex items-start gap-2 rounded-md bg-bg-secondary">
      <pre className="min-w-0 flex-1 py-3.5 pl-4 font-mono text-caption wrap-break-word whitespace-pre-wrap">
        {/* Narrow screens wrap at spaces and after a URL's slashes, never inside a word. */}
        <code>
          {code.split(/(?<=\/)(?!\/)/).map((part, index) => (
            <Fragment key={index}>
              {index > 0 && <wbr />}
              {part}
            </Fragment>
          ))}
        </code>
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        className="m-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-caption text-text hover:bg-fill-hover"
      >
        <Icon icon={state === 'copied' ? Check : Copy} size={16} />
        <span aria-live="polite">{labels[state]}</span>
      </button>
    </figure>
  )
}
