import { CircleAlert, FileQuestion } from 'lucide-react'

import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import type { FileInfo } from '@/lib/api/types'

type StateCardProps = {
  tone: 'danger' | 'neutral'
  title: string
  body: string
  retry?: () => void
}

/** Full-width explanation for a page that cannot show results (unknown id, failed file, load error). */
export function StateCard({ tone, title, body, retry }: StateCardProps) {
  return (
    <Card role={tone === 'danger' ? 'alert' : undefined} className="flex flex-col items-start gap-4">
      <span
        className={`flex items-center gap-2 ${tone === 'danger' ? 'text-danger' : 'text-text-secondary'}`}
      >
        <Icon icon={tone === 'danger' ? CircleAlert : FileQuestion} />
      </span>
      <h1 className="text-title-2">{title}</h1>
      <p className="max-w-prose text-body text-text-secondary">{body}</p>
      <div className="flex flex-wrap gap-3">
        {retry && <Button onClick={retry}>Try again</Button>}
        <ButtonLink to="/#upload" variant={retry ? 'secondary' : 'primary'}>
          Upload a file
        </ButtonLink>
        <ButtonLink to="/files" variant="ghost" chevron>
          All files
        </ButtonLink>
      </div>
    </Card>
  )
}

/** Placeholders with the final layout's sizes (header, 4 stats, map, list), so nothing shifts on load. */
export function ResultsSkeleton({ file }: { file?: FileInfo }) {
  return (
    <div aria-busy="true" aria-label="Loading results" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          {file ? (
            <h1 className="text-title-2">{file.filename}</h1>
          ) : (
            <Skeleton className="h-8 w-64 sm:h-9" />
          )}
          <Skeleton className="h-6 w-28 rounded-full md:hidden" />
          <Skeleton className="h-4.5 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-52 rounded-full" />
          <Skeleton className="h-11 w-40 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4.5 w-24" />
              <Skeleton className="h-9 w-32 sm:h-12" />
            </div>
            {/* Area and length carry a unit toggle; "Needs attention" a caption. */}
            {index < 2 && <Skeleton className="h-11 w-full" />}
            {index === 3 && <Skeleton className="-mt-2 h-4.5 w-48" />}
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <Skeleton className="h-90 rounded-lg md:col-span-6 md:h-130" />
        <div className="flex flex-col gap-3 md:col-span-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-full" />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
