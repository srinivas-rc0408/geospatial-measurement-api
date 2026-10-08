import type { RefObject } from 'react'

import { Dropzone } from './Dropzone'
import { FailedCard, ProgressCard } from './UploadProgress'
import type { UploadFlow } from './useUploadFlow'

/** One card, three faces: dropzone → progress → failure. The shared layoutId morphs between them. */
export function UploadCard({
  flow,
  inputRef,
}: {
  flow: UploadFlow
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const { phase } = flow
  switch (phase.kind) {
    case 'idle':
      return (
        <Dropzone
          onFile={flow.start}
          onProblem={flow.reportProblem}
          problem={flow.problem}
          limits={flow.limits}
          inputRef={inputRef}
        />
      )
    case 'uploading':
      return <ProgressCard file={phase.file} step={0} progress={phase.progress} />
    case 'processing':
      return <ProgressCard file={phase.file} step={1} progress={1} />
    case 'measured':
      return <ProgressCard file={phase.file} step={2} progress={1} />
    case 'failed':
      return <FailedCard file={phase.file} reason={phase.reason} onRetry={flow.reset} />
  }
}
