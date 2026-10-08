import { createContext, useContext } from 'react'

export type ShowToast = (message: string) => void

export const ToastContext = createContext<ShowToast | null>(null)

/** Show a short, non-blocking confirmation ("Link copied"). Must be inside <ToastProvider>. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside <ToastProvider>')
  return show
}
