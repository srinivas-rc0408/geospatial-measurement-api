/** Checks a file before it is sent, so common mistakes get an instant, plain answer. */
import { ApiError, NetworkError } from '@/lib/api/errors'
import { formatBytes } from '@/lib/format'

export const MAX_UPLOAD_MB = 10
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['.zip', '.kml', '.kmz'] as const

export type Problem = { message: string; hint?: string }

const FORMATS_HINT =
  'Upload a Shapefile as a .zip (with its .shp, .shx and .dbf files), or a .kml or .kmz file.'

/** A Problem for a file the server would reject, or null if it is worth sending. */
export function validateFile(file: File): Problem | null {
  const name = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return { message: `“${file.name}” is not a supported file type.`, hint: FORMATS_HINT }
  }
  if (file.size === 0)
    return { message: `“${file.name}” is empty.`, hint: 'Choose the file again or export it once more.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      message: `“${file.name}” is ${formatBytes(file.size)}; the limit is ${MAX_UPLOAD_MB} MB.`,
      hint: 'Split the data into smaller files, or remove layers you do not need.',
    }
  }
  return null
}

/** The server's reason plus what to do next, for a failed upload. */
export function uploadProblem(error: unknown): Problem {
  if (error instanceof NetworkError) return { message: error.message }
  if (!(error instanceof ApiError)) return { message: 'The upload failed. Try again.' }
  const hints: Partial<Record<number, string>> = {
    413: `Files can be up to ${MAX_UPLOAD_MB} MB. Split the data into smaller files.`,
    415: FORMATS_HINT,
    422: 'Check that the file opens in a GIS tool such as QGIS, then export it again.',
  }
  const hint = hints[error.status]
  return hint ? { message: error.detail, hint } : { message: error.detail }
}
