import { useRef } from 'react'

import { BuiltForAccuracy } from '@/features/home/BuiltForAccuracy'
import { ForDevelopers } from '@/features/home/ForDevelopers'
import { Hero } from '@/features/home/Hero'
import { HowItWorks } from '@/features/home/HowItWorks'
import { Section } from '@/features/home/Section'
import { WhyProjection } from '@/features/home/WhyProjection'
import { SampleCards } from '@/features/upload/SampleCards'
import { UploadCard } from '@/features/upload/UploadCard'
import { useUploadFlow } from '@/features/upload/useUploadFlow'

function scrollToSection(id: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
}

export default function Home() {
  const flow = useUploadFlow()
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <title>Geo Measure · Measure every site. Precisely.</title>
      <Hero
        onUpload={() => {
          scrollToSection('upload')
          fileInput.current?.click() // the picker opens straight away; the card is in view behind it
        }}
        onTrySample={() => {
          scrollToSection('samples')
        }}
      />
      <Section
        id="upload"
        title="Measure a file"
        lead="Your file is measured on the server and kept so you can come back to the results."
      >
        <UploadCard flow={flow} inputRef={fileInput} />
        <div id="samples" className="flex scroll-mt-nav flex-col gap-4">
          <h3 className="text-title-3">Or try a sample</h3>
          <SampleCards flow={flow} />
        </div>
      </Section>
      <HowItWorks />
      <WhyProjection />
      <BuiltForAccuracy />
      <ForDevelopers />
    </>
  )
}
