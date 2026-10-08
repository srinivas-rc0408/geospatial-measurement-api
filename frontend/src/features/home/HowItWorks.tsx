import { Globe, Ruler, Upload } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { Reveal } from '@/components/ui/Reveal'

import { Section } from './Section'

const STEPS = [
  {
    icon: Upload,
    title: 'Upload',
    text: 'Drop a Shapefile ZIP, a KML or a KMZ. Every layer and folder is read, whatever its coordinate system.',
  },
  {
    icon: Globe,
    title: 'Reproject',
    text: 'Each feature moves into the UTM zone of its own centre, where a metre on the map is a metre on the ground.',
  },
  {
    icon: Ruler,
    title: 'Measure',
    text: 'Areas and lengths come back in metres, cross-checked against a calculation on the Earth’s true shape.',
  },
]

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works">
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal delay={index * 0.08} className="flex flex-col gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-fill text-accent">
                <Icon icon={step.icon} />
              </span>
              <h3 className="text-title-3">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="text-body text-text-secondary">{step.text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
