import { FileUp, Layers, Ruler } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/toastContext'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatArea, formatNumber } from '@/lib/format'

const STATUSES = [
  'MEASURED',
  'NOT_APPLICABLE',
  'UNSUPPORTED',
  'FAILED',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
] as const
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'measured', label: 'Measured' },
  { value: 'attention', label: 'Needs attention' },
] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-caption font-semibold text-text-secondary">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

function Panel({ theme }: { theme: 'light' | 'dark' }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const toast = useToast()

  return (
    <div data-theme={theme} className="flex min-w-0 flex-col gap-8 rounded-lg bg-bg p-6 text-text sm:p-8">
      <h2 className="text-title-3">{theme === 'light' ? 'Light' : 'Dark'}</h2>
      <Section title="Button">
        <Button>Upload a file</Button>
        <Button variant="secondary">Choose file</Button>
        <Button variant="ghost" chevron>
          Try a sample
        </Button>
        <Button loading>Uploading</Button>
        <Button disabled>Disabled</Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
      </Section>
      <Section title="StatusPill">
        {STATUSES.map((status) => (
          <StatusPill key={status} status={status} />
        ))}
      </Section>
      <Section title="SegmentedControl">
        <div className="w-full max-w-sm">
          <SegmentedControl
            label={`Filter (${theme})`}
            options={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </Section>
      <Section title="Card + Stat">
        <Card className="flex w-full flex-wrap gap-8">
          <Stat label="Total area" value={formatNumber(232000.35 / 10_000, 2)} unit="ha" />
          <Stat label="Total length" value={formatNumber(1370.02 / 1000, 2)} unit="km" />
          <Stat label="Measured" value="5 of 7" />
        </Card>
      </Section>
      <Section title="Skeleton">
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Section>
      <Section title="CodeBlock">
        <div className="w-full">
          <CodeBlock
            label="curl upload command"
            code={'curl -F "file=@site.kml" http://localhost:8000/api/files/'}
          />
        </div>
      </Section>
      <Section title="Tooltip · Sheet · Toast">
        <Tooltip content="Measured on the Earth's curved surface, with no map projection.">
          <Button variant="secondary">Geodesic</Button>
        </Tooltip>
        <Button
          variant="secondary"
          onClick={() => {
            setSheetOpen(true)
          }}
        >
          Open sheet
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            toast('Link copied')
          }}
        >
          Show toast
        </Button>
      </Section>
      <Section title="Icon (20 px, stroke 1.75)">
        <Icon icon={FileUp} />
        <Icon icon={Layers} />
        <Icon icon={Ruler} />
      </Section>
      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Pit boundary"
        description="Polygon · Site boundaries"
      >
        <p className="text-body">Area {formatArea(232000.35)}</p>
      </Sheet>
    </div>
  )
}

/** Development-only gallery of every UI primitive, light and dark side by side. Not in production builds. */
export default function DevGallery() {
  return (
    <div className="mx-auto flex max-w-workspace flex-col gap-6 px-5.5 py-12 sm:px-10">
      <title>UI gallery · Geo Measure</title>
      <h1 className="text-title-2">UI gallery</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel theme="light" />
        <Panel theme="dark" />
      </div>
    </div>
  )
}
