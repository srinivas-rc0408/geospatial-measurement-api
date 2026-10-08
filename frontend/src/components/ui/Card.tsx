import type { HTMLAttributes } from 'react'

/** Surface, radius 18, shadow (light) or elevation colour (dark), padding 24 / 32. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['rounded-lg bg-surface p-6 shadow-card sm:p-8', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}
