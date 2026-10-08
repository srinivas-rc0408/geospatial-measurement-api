import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ToastContext } from './toastContext'

export const TOAST_DURATION_MS = 4000
/** Older toasts are dropped beyond this many, so a burst never covers the page. */
const MAX_TOASTS = 3

type Toast = { id: number; message: string }

/** One toast: dismisses itself after 4 s, and waits while the pointer is over it (to finish reading). */
function ToastItem({
  id,
  message,
  onDismiss,
}: {
  id: number
  message: string
  onDismiss: (id: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(TOAST_DURATION_MS)

  useEffect(() => {
    if (paused) return
    const started = Date.now()
    const timer = setTimeout(() => {
      onDismiss(id)
    }, remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [paused, id, onDismiss])

  return (
    // Hover only pauses the timer of a non-interactive message; there is nothing to operate.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => {
        setPaused(true)
      }}
      onMouseLeave={() => {
        setPaused(false)
      }}
      className="pointer-events-auto animate-toast-in rounded-full border border-separator bg-nav-glass px-5 py-2.5 text-callout text-text shadow-card backdrop-blur-glass backdrop-saturate-180"
    >
      {message}
    </div>
  )
}

/**
 * Glass toasts stacked at the top centre. The live region is always mounted
 * (screen readers ignore regions that appear together with their content).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const show = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }].slice(-MAX_TOASTS))
  }, [])
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} id={toast.id} message={toast.message} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  )
}
