import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { ToastContext } from './toastContext'

export const TOAST_DURATION_MS = 4000

type Toast = { id: number; message: string }

/**
 * Glass toasts at the top centre, auto-dismissed after 4 s. The live region is always mounted
 * (screen readers ignore regions that appear together with their content).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [])

  const show = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }])
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, TOAST_DURATION_MS)
    timers.current.add(timer)
  }, [])

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-toast-in rounded-full border border-separator bg-nav-glass px-5 py-2.5 text-callout text-text shadow-card backdrop-blur-glass backdrop-saturate-180"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
