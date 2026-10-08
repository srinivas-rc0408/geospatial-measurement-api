import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactElement, ReactNode } from 'react'

/** Mount once near the root; shares the open delay across tooltips. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>
}

type TooltipProps = {
  /** One plain-English line explaining the term. */
  content: string
  /** A focusable element (button or link): tooltips open on hover and on keyboard focus. */
  children: ReactElement
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 max-w-xs animate-overlay-in rounded-sm bg-text px-3 py-2 text-caption text-bg shadow-card"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
