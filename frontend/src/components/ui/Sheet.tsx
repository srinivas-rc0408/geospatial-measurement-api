import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

import { Icon } from './Icon'

type SheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
}

/**
 * A modal panel: bottom sheet on mobile, 420 px right-side drawer from 734 px up.
 * Radix provides the focus trap and Esc / overlay-click to close.
 */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  // Radix returns focus only to a Dialog.Trigger. Sheets open from rows, map features or any button,
  // so remember whatever had focus when the sheet opened and return focus there on close.
  const opener = useRef<HTMLElement | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-overlay-in bg-overlay" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] animate-sheet-in-bottom flex-col rounded-t-lg bg-surface-elevated shadow-card focus:outline-none sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-sheet sm:animate-sheet-in-right sm:rounded-none"
        >
          <header className="flex items-start justify-between gap-4 border-b border-separator px-6 py-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-title-3">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-callout text-text-secondary">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-fill-hover"
            >
              <Icon icon={X} />
            </Dialog.Close>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
