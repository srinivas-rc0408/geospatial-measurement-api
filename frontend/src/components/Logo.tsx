import markSvg from '@/assets/logo-mark.svg?raw'

/**
 * The mark is inlined (not an <img>) so its CSS variables follow the theme. The markup is our own
 * build-time file — the same one the brand-asset script turns into the favicon and OG image.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={['inline-block shrink-0 [&>svg]:size-full', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: markSvg }}
    />
  )
}

/** Mark + "Geo Measure" wordmark. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-wordmark whitespace-nowrap">
      <LogoMark className="size-6" />
      Geo Measure
    </span>
  )
}
