import { Button } from '@/components/ui/Button'

import { ContourBackground } from './ContourBackground'

type HeroProps = { onUpload: () => void; onTrySample: () => void }

export function Hero({ onUpload, onTrySample }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden">
      <ContourBackground />
      <div aria-hidden="true" className="hero-glow -z-10" />
      <div className="mx-auto flex max-w-marketing flex-col items-center justify-center gap-5 px-5.5 py-24 text-center sm:px-10 md:min-h-hero">
        <p className="animate-fade-up text-caption font-semibold text-text-secondary stagger-0">
          Geospatial File Measurement API
        </p>
        <h1 className="animate-fade-up text-display text-balance stagger-1">
          Measure every site. Precisely.
        </h1>
        <p className="max-w-prose animate-fade-up text-body text-pretty text-text-secondary stagger-2">
          Upload a Shapefile or KML. Get areas and lengths in metres — computed in the right projection for
          every feature, and cross-checked against the Earth&apos;s true shape.
        </p>
        <div className="mt-3 flex animate-fade-up flex-wrap items-center justify-center gap-3 stagger-3">
          <Button onClick={onUpload}>Upload a file</Button>
          <Button variant="ghost" chevron onClick={onTrySample}>
            Try a sample
          </Button>
        </div>
      </div>
    </section>
  )
}
