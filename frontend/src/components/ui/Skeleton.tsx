/** A loading placeholder block; size it with className to match the final layout (no layout shift). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={['animate-shimmer rounded-sm bg-fill', className].filter(Boolean).join(' ')}
    />
  )
}
