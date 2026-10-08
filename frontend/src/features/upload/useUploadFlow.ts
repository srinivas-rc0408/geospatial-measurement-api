/**
 * The upload flow shared by the dropzone and the sample cards:
 * validate → upload (with progress) → poll while processing → open the results, or explain the failure.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { useToast } from '@/components/ui/toastContext'
import { useClientConfig, useFile, useUploadFile } from '@/lib/api/hooks'
import type { ClientConfig } from '@/lib/api/types'
import { formatCount } from '@/lib/format'

import { uploadProblem, validateFile, type Problem } from './validateFile'

/** How long the "Measured" step stays visible before the results open. */
export const COMPLETE_PAUSE_MS = 600

export type UploadPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; file: File; progress: number }
  | { kind: 'processing'; file: File; id: string }
  | { kind: 'measured'; file: File; id: string }
  | { kind: 'failed'; file: File; reason: string }

export type UploadFlow = {
  phase: UploadPhase
  /** Why the last attempt was rejected before or during upload; shown under the dropzone. */
  problem: Problem | null
  /** The server's upload limits (undefined while loading or if unavailable). */
  limits: ClientConfig | undefined
  start: (file: File) => void
  reportProblem: (problem: Problem) => void
  reset: () => void
}

export function useUploadFlow(): UploadFlow {
  const [phase, setPhase] = useState<UploadPhase>({ kind: 'idle' })
  const [problem, setProblem] = useState<Problem | null>(null)
  const upload = useUploadFile()
  const { data: limits } = useClientConfig()
  const navigate = useNavigate()
  const toast = useToast()

  // Measured / failed are derived from the polled file, not stored: one source of truth.
  const processingId = phase.kind === 'processing' ? phase.id : undefined
  const { data: info, error: pollError } = useFile(processingId)
  let current = phase
  let currentProblem = problem
  if (phase.kind === 'processing') {
    if (pollError) {
      current = { kind: 'idle' }
      currentProblem = uploadProblem(pollError, limits)
    } else if (info?.id === phase.id && info.status === 'COMPLETED') {
      current = { kind: 'measured', file: phase.file, id: phase.id }
    } else if (info?.id === phase.id && info.status === 'FAILED') {
      current = { kind: 'failed', file: phase.file, reason: info.error ?? 'The file could not be processed.' }
    }
  }

  const measuredId = current.kind === 'measured' ? current.id : undefined
  const featureCount = info?.feature_count ?? 0
  const fileName = phase.kind === 'idle' ? '' : phase.file.name
  useEffect(() => {
    if (!measuredId) return
    const timer = setTimeout(() => {
      toast(`Measured ${fileName} · ${formatCount(featureCount, 'feature')}`)
      void navigate(`/files/${measuredId}`)
    }, COMPLETE_PAUSE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [measuredId, fileName, featureCount, navigate, toast])

  function start(file: File) {
    const invalid = validateFile(file, limits)
    setProblem(invalid)
    if (invalid) return
    setPhase({ kind: 'uploading', file, progress: 0 })
    upload.mutate(
      {
        file,
        onProgress: (progress) => {
          setPhase((current) => (current.kind === 'uploading' ? { ...current, progress } : current))
        },
      },
      {
        onSuccess: (created) => {
          setPhase({ kind: 'processing', file, id: created.id })
        },
        onError: (error) => {
          setPhase({ kind: 'idle' })
          setProblem(uploadProblem(error, limits))
        },
      },
    )
  }

  return {
    phase: current,
    problem: currentProblem,
    limits,
    start,
    reportProblem: setProblem,
    reset: () => {
      setPhase({ kind: 'idle' })
      setProblem(null)
    },
  }
}
