/** Checks a file before it is sent, so common mistakes get an instant, plain answer. */
import { ApiError, NetworkError } from '@/lib/api/errors'
import type { ClientConfig } from '@/lib/api/types'
import { formatBytes, formatNumber } from '@/lib/format'

export type Problem = { message: string; hint?: string }

const FORMATS_HINT =
  'Upload a Shapefile as a .zip (with its .shp, .shx and .dbf files), or a .kml or .kmz file.'
const BYTES_PER_MB = 1024 * 1024

/** "10 MB", "2.5 MB": the server's limit as people read it. */
export function formatLimit(megabytes: number): string {
  return `${formatNumber(megabytes, Number.isInteger(megabytes) ? 0 : 1)} MB`
}

/**
 * A Problem for a file the server would reject, or null if it is worth sending. Without the server's
 * limits (still loading, or unavailable) only emptiness is checked; the server still validates everything.
 */
export function validateFile(file: File, limits: ClientConfig | undefined): Problem | null {
  const name = file.name.toLowerCase()
  if (limits && !limits.accepted_extensions.some((extension) => name.endsWith(extension))) {
    return { message: `“${file.name}” is not a supported file type.`, hint: FORMATS_HINT }
  }
  if (file.size === 0) {
    return { message: `“${file.name}” is empty.`, hint: 'Choose the file again or export it once more.' }
  }
  if (limits && file.size > limits.max_upload_mb * BYTES_PER_MB) {
    return {
      message: `“${file.name}” is ${formatBytes(file.size)}; the limit is ${formatLimit(limits.max_upload_mb)}.`,
      hint: 'Split the data into smaller files, or remove layers you do not need.',
    }
  }
  return null
}

/** The server's reason plus what to do next, for a failed upload. */
export function uploadProblem(error: unknown, limits?: ClientConfig): Problem {
  if (error instanceof NetworkError) return { message: error.message }
  if (!(error instanceof ApiError)) return { message: 'The upload failed. Try again.' }
  const tooLarge = limits
    ? `Files can be up to ${formatLimit(limits.max_upload_mb)}. Split the data into smaller files.`
    : 'Split the data into smaller files.'
  const hints: Partial<Record<number, string>> = {
    413: tooLarge,
    415: FORMATS_HINT,
    422: 'Check that the file opens in a GIS tool such as QGIS, then export it again.',
  }
  const hint = hints[error.status]
  return hint ? { message: error.detail, hint } : { message: error.detail }
}
