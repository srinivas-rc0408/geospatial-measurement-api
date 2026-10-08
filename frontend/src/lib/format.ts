/**
 * Every number, unit and date shown in the UI goes through this module (docs/DESIGN_SYSTEM.md §5).
 * Measurements: m² with 0 decimals, ha with 2; m with 1 decimal, km with 2; en-US grouping.
 * A missing value (null/undefined) renders as an em dash. Negative or non-finite measurements are
 * programming errors (the API never returns them) and throw, so they cannot be shown silently.
 */
import type { FileStatus, FileType, MeasurementStatus } from './api/types'

export const MISSING = '—'
const LOCALE = 'en-US'
const M2_PER_HECTARE = 10_000
const M_PER_KM = 1_000

const numberFormats = new Map<number, Intl.NumberFormat>()

/** Fixed decimals with en-US grouping, e.g. 1234567.891 → "1,234,567.89". */
export function formatNumber(value: number, decimals: number): string {
  let format = numberFormats.get(decimals)
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    numberFormats.set(decimals, format)
  }
  // + 0 turns -0 (e.g. a rounding artefact) into 0, so "-0" is never shown.
  return format.format(value + 0)
}

function assertMeasurement(value: number, what: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${what} must be a finite, non-negative number, got ${value}`)
  }
}

export type AreaUnit = 'm2' | 'ha'
export type LengthUnit = 'm' | 'km'

export const AREA_UNIT_LABEL: Record<AreaUnit, string> = { m2: 'm²', ha: 'ha' }
export const LENGTH_UNIT_LABEL: Record<LengthUnit, string> = { m: 'm', km: 'km' }

/** The number part of an area (no unit), for layouts that style the unit separately. */
export function formatAreaValue(squareMetres: number, unit: AreaUnit): string {
  assertMeasurement(squareMetres, 'Area')
  return unit === 'ha' ? formatNumber(squareMetres / M2_PER_HECTARE, 2) : formatNumber(squareMetres, 0)
}

/** The number part of a length (no unit). */
export function formatLengthValue(metres: number, unit: LengthUnit): string {
  assertMeasurement(metres, 'Length')
  return unit === 'km' ? formatNumber(metres / M_PER_KM, 2) : formatNumber(metres, 1)
}

/** Area given in square metres, shown in m² (0 decimals) or hectares (2 decimals). */
export function formatArea(squareMetres: number | null | undefined, unit: AreaUnit = 'm2'): string {
  if (squareMetres == null) return MISSING
  return `${formatAreaValue(squareMetres, unit)} ${AREA_UNIT_LABEL[unit]}`
}

/** Length given in metres, shown in m (1 decimal) or kilometres (2 decimals). */
export function formatLength(metres: number | null | undefined, unit: LengthUnit = 'm'): string {
  if (metres == null) return MISSING
  return `${formatLengthValue(metres, unit)} ${LENGTH_UNIT_LABEL[unit]}`
}

const BYTE_UNITS = ['KB', 'MB', 'GB'] as const

/** File size in binary units (1 MB = 1024 KB), matching the backend's upload limit. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return MISSING
  assertMeasurement(bytes, 'Size')
  if (bytes < 1024) return `${formatNumber(bytes, 0)} B`
  let value = bytes
  let unit: (typeof BYTE_UNITS)[number] = 'KB'
  for (const next of BYTE_UNITS) {
    value /= 1024
    unit = next
    if (value < 1024) break
  }
  return `${formatNumber(value, 1)} ${unit}`
}

/**
 * How far the projected measurement is from the geodesic (ellipsoidal) one, e.g. "+0.12%".
 * Missing when either value is missing or the geodesic value is 0 (no meaningful ratio).
 */
export function formatPercentDifference(
  projected: number | null | undefined,
  geodesic: number | null | undefined,
): string {
  if (projected == null || geodesic == null) return MISSING
  assertMeasurement(projected, 'Projected value')
  assertMeasurement(geodesic, 'Geodesic value')
  if (geodesic === 0) return MISSING
  const percent = ((projected - geodesic) / geodesic) * 100
  const rounded = Math.round(percent * 100) / 100 + 0
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '' // U+2212 minus sign
  return `${sign}${formatNumber(Math.abs(rounded), 2)}%`
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]
const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday", "in 2 hours". */
export function formatRelativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (value == null) return MISSING
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MISSING
  const seconds = (date.getTime() - now.getTime()) / 1000
  if (Math.abs(seconds) < 45) return 'just now'
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit)
  }
  return relativeFormat.format(Math.round(seconds / 60), 'minute')
}

/** "Oct 7, 2026, 2:41 PM" in the viewer's time zone (or the one given, for tests). */
export function formatDateTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (value == null) return MISSING
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return MISSING
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

const STATUS_LABELS: Record<FileStatus | MeasurementStatus, string> = {
  PENDING: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  MEASURED: 'Measured',
  NOT_APPLICABLE: 'Not applicable',
  UNSUPPORTED: 'Unsupported',
}

export function statusLabel(status: FileStatus | MeasurementStatus): string {
  return STATUS_LABELS[status]
}

const FILE_TYPE_LABELS: Record<FileType, string> = { SHAPEFILE: 'Shapefile', KML: 'KML', KMZ: 'KMZ' }

export function fileTypeLabel(type: FileType): string {
  return FILE_TYPE_LABELS[type]
}

/** "1 feature", "7 features", "1,204 features" (regular English plurals only). */
export function formatCount(count: number, noun: string): string {
  return `${formatNumber(count, 0)} ${count === 1 ? noun : `${noun}s`}`
}
