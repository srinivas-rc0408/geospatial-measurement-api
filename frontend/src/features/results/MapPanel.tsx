import type { UseQueryResult } from '@tanstack/react-query'
import type { FeatureCollection, Geometry } from 'geojson'
import { useInView } from 'motion/react'
import { lazy, Suspense, useRef } from 'react'

import { Skeleton } from '@/components/ui/Skeleton'

import type { ResultsMapProps } from './ResultsMap'

// MapLibre is ~280 kB gzipped: it loads only on this page, in its own chunk.
const ResultsMap = lazy(() => import('./ResultsMap'))

type MapPanelProps = Omit<ResultsMapProps, 'geojson'> & {
  geojson: UseQueryResult<FeatureCollection<Geometry | null>>
}

/**
 * The map box: fixed heights (360 px mobile, 520 px desktop), so nothing shifts when the map arrives.
 * The map itself — the heaviest code on the site — starts only when the box scrolls into view: at once
 * on desktop, after the totals on a phone (so a phone's first load stays fast).
 */
export function MapPanel({ geojson, ...mapProps }: MapPanelProps) {
  const box = useRef<HTMLDivElement>(null)
  const near = useInView(box, { once: true })
  const placeholder = <Skeleton className="size-full rounded-none" />

  return (
    <div
      ref={box}
      className="h-90 overflow-hidden rounded-lg bg-surface md:sticky md:top-20 md:col-span-6 md:h-130"
    >
      {geojson.isError ? (
        <p className="flex size-full items-center justify-center p-6 text-center text-callout text-text-secondary">
          The map could not be loaded. The measurements are all listed here.
        </p>
      ) : geojson.data && near ? (
        <Suspense fallback={placeholder}>
          <ResultsMap geojson={geojson.data} {...mapProps} />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  )
}
