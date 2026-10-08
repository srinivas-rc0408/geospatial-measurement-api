import { Button } from '@/components/ui/Button'

type FinalCtaProps = { onUpload: () => void; onTrySample: () => void }

export function FinalCta({ onUpload, onTrySample }: FinalCtaProps) {
  return (
    <section aria-labelledby="final-cta-title" className="bg-bg-alt">
      <div aria-hidden="true" className="divider-fade" />
      <div className="mx-auto flex max-w-marketing flex-col items-center gap-6 px-5.5 py-16 text-center sm:px-10 sm:py-24 md:py-32">
        <h2 id="final-cta-title" className="text-title-1 text-balance">
          Measure your first site.
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onUpload}>Upload a file</Button>
          <Button variant="ghost" chevron onClick={onTrySample}>
            Try a sample
          </Button>
        </div>
      </div>
    </section>
  )
}
