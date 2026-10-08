import { animate, useInView, useReducedMotionConfig } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

export const COUNT_UP_SECONDS = 0.6

type CountUpProps = {
  value: number
  /** Formats the number for display (always the formatter module, so rounding is consistent). */
  format: (value: number) => string
  className?: string
}

/**
 * Counts from 0 to `value` once, when first visible. An invisible copy of the final text holds the
 * width, so nothing shifts while digits are added; screen readers only get the final value.
 */
export function CountUp({ value, format, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduced = useReducedMotionConfig() ?? false
  // null = show the final value (finished, or reduced motion)
  const [shown, setShown] = useState<number | null>(reduced ? null : 0)

  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, value, {
      duration: COUNT_UP_SECONDS,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: setShown,
      onComplete: () => {
        setShown(null)
      },
    })
    return () => {
      controls.stop()
    }
  }, [inView, reduced, value])

  const final = format(value)
  return (
    <span ref={ref} className={['relative inline-grid tabular-nums', className].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {final}
      </span>
      <span aria-hidden="true" className="col-start-1 row-start-1 text-right">
        {shown === null ? final : format(shown)}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  )
}
