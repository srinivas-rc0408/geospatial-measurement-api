import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fileTypeLabel } from '@/lib/format'

import { loadSample, SAMPLES, type Sample } from './samples'
import type { UploadFlow } from './useUploadFlow'

/** One click uploads a bundled sample through exactly the same flow as a user's file. */
export function SampleCards({ flow }: { flow: UploadFlow }) {
  const [loading, setLoading] = useState<string | null>(null)
  const busy =
    flow.phase.kind === 'uploading' || flow.phase.kind === 'processing' || flow.phase.kind === 'measured'

  async function measure(sample: Sample) {
    setLoading(sample.file)
    try {
      flow.start(await loadSample(sample))
    } catch {
      flow.reportProblem({
        message: `The sample “${sample.title}” could not be loaded. Reload the page and try again.`,
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {SAMPLES.map((sample) => (
        <li key={sample.file}>
          <Card className="flex h-full flex-col items-start gap-3">
            <span className="rounded-full border border-separator px-2.5 py-0.5 text-caption font-semibold text-text-secondary">
              {fileTypeLabel(sample.type)}
            </span>
            <h4 className="text-title-3">{sample.title}</h4>
            <p className="flex-1 text-callout text-text-secondary">{sample.description}</p>
            <Button
              variant="ghost"
              chevron
              className="-ml-2"
              loading={loading === sample.file}
              disabled={busy}
              aria-label={`Measure the ${sample.title} sample`}
              onClick={() => void measure(sample)}
            >
              Measure
            </Button>
          </Card>
        </li>
      ))}
    </ul>
  )
}
