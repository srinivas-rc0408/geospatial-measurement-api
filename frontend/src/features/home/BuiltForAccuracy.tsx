import { Globe, Grid3x3, ShieldCheck, Wrench } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { Reveal } from '@/components/ui/Reveal'

import { Section } from './Section'

const FACTS = [
  {
    icon: Grid3x3,
    title: 'Per-feature UTM zones',
    text: 'Every feature is measured in the zone of its own centre, so sites that cross a zone boundary stay accurate.',
  },
  {
    icon: Globe,
    title: 'Geodesic cross-check',
    text: 'Each result is compared with a calculation on the WGS84 ellipsoid; large differences are flagged.',
  },
  {
    icon: Wrench,
    title: 'Invalid polygon repair',
    text: 'Self-intersecting outlines are repaired before measuring, and the repair is noted on the feature.',
  },
  {
    icon: ShieldCheck,
    title: 'One bad feature never fails the file',
    text: 'Every feature gets its own status and reason; the rest of the file is still measured.',
  },
]

export function BuiltForAccuracy() {
  return (
    <Section id="accuracy" title="Built for accuracy">
      <ul className="grid gap-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-10">
        {FACTS.map((fact, index) => (
          <li key={fact.title}>
            <Reveal delay={(index % 2) * 0.08} className="flex gap-4">
              <Icon icon={fact.icon} className="mt-0.5 shrink-0 text-accent" />
              <div className="flex flex-col gap-1">
                <h3 className="text-body font-semibold">{fact.title}</h3>
                <p className="text-callout text-text-secondary">{fact.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  )
}
