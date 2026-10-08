import { useParams } from 'react-router'

import { ResultsHeader } from '@/features/results/ResultsHeader'
import { ResultsSkeleton, StateCard } from '@/features/results/ResultsStates'
import { Workspace } from '@/features/results/Workspace'
import { ProgressCard } from '@/features/upload/UploadProgress'
import { ApiError } from '@/lib/api/errors'
import { isInProgress, useFile } from '@/lib/api/hooks'

function Content({ id }: { id: string }) {
  const { data: file, error, refetch } = useFile(id)

  if (error) {
    return error instanceof ApiError && error.status === 404 ? (
      <StateCard
        tone="neutral"
        title="File not found"
        body="There is no file with this link. It may have been deleted, or the link is incomplete."
      />
    ) : (
      <StateCard
        tone="danger"
        title="The file could not be loaded"
        body={error.message}
        retry={() => void refetch()}
      />
    )
  }
  if (!file) return <ResultsSkeleton />
  if (isInProgress(file)) {
    return (
      <div className="flex flex-col gap-8">
        <ResultsHeader file={file} />
        <ProgressCard file={{ name: file.filename, size: file.size_bytes }} step={1} progress={1} />
      </div>
    )
  }
  if (file.status === 'FAILED') {
    return (
      <StateCard
        tone="danger"
        title={`${file.filename} could not be measured`}
        body={file.error ?? 'The file could not be processed.'}
      />
    )
  }
  return <Workspace file={file} />
}

export default function Results() {
  const { id = '' } = useParams()
  return (
    <div className="mx-auto max-w-workspace px-5.5 py-10 sm:px-10 sm:py-12">
      <title>Results · Geo Measure</title>
      <Content key={id} id={id} />
    </div>
  )
}
