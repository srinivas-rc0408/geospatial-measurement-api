import { AnimatePresence, m } from 'motion/react'

import { useHealthReady } from '@/lib/api/hooks'
import { useServerWaking } from '@/lib/api/serverWaking'

/**
 * Free hosting sleeps when idle. Pinging /health/ready on load starts the wake-up early; if any
 * request is slow, this calm banner explains the wait and fades out once the server answers.
 */
export function ServerWakeBanner() {
  useHealthReady()
  const waking = useServerWaking()
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
      <AnimatePresence>
        {waking && (
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex max-w-xl items-center gap-3 rounded-lg border border-separator bg-nav-glass px-4 py-2.5 text-caption text-text shadow-card backdrop-blur-glass backdrop-saturate-180 sm:px-5 sm:py-3 sm:text-callout"
          >
            <span aria-hidden="true" className="size-2 shrink-0 animate-shimmer rounded-full bg-accent" />
            Waking up the server — free hosting sleeps when idle. This can take up to a minute.
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}
