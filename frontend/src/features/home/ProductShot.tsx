import { m, useReducedMotionConfig } from 'motion/react'

/** A real capture of the results workspace (mine site sample, dark theme), framed like a window. */
export function ProductShot() {
  const reduced = useReducedMotionConfig() ?? false
  return (
    <div className="relative mx-auto w-full max-w-marketing px-5.5 pb-16 sm:px-10 sm:pb-24">
      <div aria-hidden="true" className="product-glow" />
      <m.div
        className="relative overflow-hidden rounded-lg border border-separator bg-bg shadow-card"
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '0px 0px -96px 0px' }}
        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <picture>
          <source srcSet="/images/product-results.webp" type="image/webp" />
          <img
            src="/images/product-results.png"
            width={1600}
            height={1085}
            alt="The results workspace for the mine site sample: totals of 25.50 ha and 1.37 km, the features on a map, and the measurements table."
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </picture>
      </m.div>
    </div>
  )
}
