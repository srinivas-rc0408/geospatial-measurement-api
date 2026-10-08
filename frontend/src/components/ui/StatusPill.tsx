import type { FileStatus, MeasurementStatus } from '@/lib/api/types'
import { statusLabel } from '@/lib/format'

type Status = FileStatus | MeasurementStatus
type Tone = 'success' | 'danger' | 'neutral' | 'progress'

const tones: Record<Status, Tone> = {
  MEASURED: 'success',
  COMPLETED: 'success',
  FAILED: 'danger',
  NOT_APPLICABLE: 'neutral',
  UNSUPPORTED: 'neutral',
  PENDING: 'progress',
  PROCESSING: 'progress',
}

const styles: Record<Tone, { text: string; dot: string }> = {
  success: { text: 'text-success', dot: 'bg-success-dot' },
  danger: { text: 'text-danger', dot: 'bg-danger-dot' },
  neutral: { text: 'text-neutral', dot: 'bg-neutral-dot' },
  progress: { text: 'text-text', dot: 'bg-accent animate-shimmer' },
}

type StatusPillProps = {
  status: Status
  /** Announce changes to screen readers (role="status"); use where the status updates live. */
  live?: boolean
}

export function StatusPill({ status, live = false }: StatusPillProps) {
  const style = styles[tones[status]]
  return (
    <span
      role={live ? 'status' : undefined}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-separator px-2.5 text-caption font-semibold whitespace-nowrap ${style.text}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${style.dot}`} />
      {statusLabel(status)}
    </span>
  )
}
