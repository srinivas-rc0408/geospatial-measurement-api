import { Check, CircleAlert, FileText } from 'lucide-react'
import { m } from 'motion/react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatBytes, formatNumber } from '@/lib/format'

const STEPS = ['Uploaded', 'Processing', 'Measured'] as const

type ProgressCardProps = {
  file: { name: string; size: number }
  /** 0 = uploading, 1 = processing on the server, 2 = measured. */
  step: 0 | 1 | 2
  /** Upload progress 0–1 (only meaningful at step 0). */
  progress: number
}

const STATUS_TEXT = ['Uploading', 'Processing on the server', 'Measured · opening the results'] as const

function StepMarker({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <span className="flex size-7 items-center justify-center rounded-full bg-accent-fill text-on-accent">
        <Icon icon={Check} size={16} />
      </span>
    )
  }
  return (
    <span
      className={`flex size-7 items-center justify-center rounded-full border-2 ${state === 'active' ? 'border-accent' : 'border-separator'}`}
    >
      {state === 'active' && <span className="size-2.5 animate-shimmer rounded-full bg-accent" />}
    </span>
  )
}

/** The dropzone morphs into this card (shared layoutId) once a file is on its way. */
export function ProgressCard({ file, step, progress }: ProgressCardProps) {
  const percent = Math.round(progress * 100)
  // Measured is the last step and is done, not "in progress".
  const stateOf = (index: number) =>
    index < step || step === 2 ? 'done' : index === step ? 'active' : 'pending'

  return (
    <m.div
      layoutId="upload-card"
      className="flex flex-col gap-8 rounded-lg bg-surface p-6 shadow-card sm:p-8"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-fill text-text-secondary">
          <Icon icon={FileText} />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-body font-semibold">{file.name}</p>
          <p className="text-caption text-text-secondary">{formatBytes(file.size)}</p>
        </div>
      </div>

      <ol className="grid grid-cols-3">
        {STEPS.map((label, index) => (
          <li key={label} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 && (
              // Connector from the previous step's centre to this one's (the markers cover its ends).
              <span aria-hidden="true" className="absolute top-3.5 right-1/2 h-0.5 w-full bg-separator">
                <span
                  className="block h-full origin-left bg-accent transition-transform duration-400 ease-standard"
                  style={{ transform: `scaleX(${index <= step ? 1 : 0})` }}
                />
              </span>
            )}
            <span className="relative rounded-full bg-surface">
              <StepMarker state={stateOf(index)} />
            </span>
            <span
              className={`text-caption ${stateOf(index) === 'pending' ? 'text-text-secondary' : 'font-semibold text-text'}`}
            >
              {label}
              <span className="sr-only">
                {stateOf(index) === 'done' ? ' (done)' : stateOf(index) === 'active' ? ' (in progress)' : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        {step === 0 ? (
          <div
            role="progressbar"
            aria-label={`Uploading ${file.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-1 overflow-hidden rounded-full bg-fill"
          >
            <div
              className="h-full origin-left rounded-full bg-accent transition-transform duration-150"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        ) : (
          <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-fill">
            <div className={`h-full rounded-full bg-accent ${step === 1 ? 'animate-shimmer' : ''}`} />
          </div>
        )}
        <p className="flex justify-between text-caption text-text-secondary">
          {/* Announce each step once; the percentage is on the progress bar, not re-announced. */}
          <span aria-live="polite">{STATUS_TEXT[step]}</span>
          {step === 0 && <span className="tabular-nums">{formatNumber(percent, 0)}%</span>}
        </p>
      </div>
    </m.div>
  )
}

type FailedCardProps = { file: { name: string }; reason: string; onRetry: () => void }

export function FailedCard({ file, reason, onRetry }: FailedCardProps) {
  return (
    <m.div
      layoutId="upload-card"
      role="alert"
      className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6 shadow-card sm:p-8"
    >
      <span className="flex items-center gap-2 text-danger">
        <Icon icon={CircleAlert} />
        <span className="text-callout font-semibold">Could not measure {file.name}</span>
      </span>
      <p className="text-body text-text">{reason}</p>
      <Button onClick={onRetry}>Try another file</Button>
    </m.div>
  )
}
