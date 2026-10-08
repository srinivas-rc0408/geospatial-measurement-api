import { m, useReducedMotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

type RevealProps = { children: ReactNode; className?: string; delay?: number }

/** Fades content up the first time it scrolls into view (opacity only, 100 ms, for reduced motion). */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduced = useReducedMotionConfig() ?? false
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -64px 0px' }}
      transition={reduced ? { duration: 0.1 } : { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </m.div>
  )
}
