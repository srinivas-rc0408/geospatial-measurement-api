import { ExternalLink } from '@/app/ExternalLink'
import { README_CRS_URL } from '@/app/links'
import { CountUp } from '@/components/ui/CountUp'
import { Reveal } from '@/components/ui/Reveal'
import { formatArea } from '@/lib/format'

import { Section } from './Section'

/** The Web Mercator sample: what a naive tool reports vs what the API measures (geodesic check: 943,822 m²). */
const NAIVE_M2 = 1_000_000
const CORRECT_M2 = 944_917

export function WhyProjection() {
  return (
    <Section id="why-projection" title="Why projection matters" tone="secondary">
      <Reveal className="grid gap-10 sm:grid-cols-2 sm:gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-callout text-text-secondary">Naive, in Web Mercator</p>
          <p className="text-stat text-text-secondary line-through decoration-2">
            <span className="sr-only">Incorrect: </span>
            {formatArea(NAIVE_M2)}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-callout font-semibold text-text">Correct, in UTM 43N</p>
          <p className="text-stat text-text">
            <CountUp value={CORRECT_M2} format={formatArea} />
          </p>
        </div>
      </Reveal>
      <p className="max-w-prose text-body text-pretty text-text-secondary">
        Web Mercator stretches the map away from the equator, so a square that is 1,000 units wide in it near
        Bengaluru covers about 6% less ground than its coordinates suggest. At 60° north, the naive figure
        would be four times too large.{' '}
        <ExternalLink href={README_CRS_URL} className="inline-flex items-center text-link hover:underline">
          Learn how
        </ExternalLink>
      </p>
    </Section>
  )
}
