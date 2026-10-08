import { describe, expect, it } from 'vitest'

import {
  formatArea,
  formatBytes,
  formatDateTime,
  formatLength,
  formatNumber,
  formatPercentDifference,
  formatRelativeTime,
  MISSING,
  statusLabel,
} from './format'

describe('formatArea', () => {
  it('shows m² with 0 decimals and en-US grouping', () => {
    expect(formatArea(232000.35)).toBe('232,000 m²')
    expect(formatArea(944917.4)).toBe('944,917 m²')
    expect(formatArea(944917.5)).toBe('944,918 m²')
  })

  it('shows hectares with 2 decimals', () => {
    expect(formatArea(232000.35, 'ha')).toBe('23.20 ha')
    expect(formatArea(255000.291, 'ha')).toBe('25.50 ha')
  })

  it('handles 0, very small and very large values', () => {
    expect(formatArea(0)).toBe('0 m²')
    expect(formatArea(0, 'ha')).toBe('0.00 ha')
    expect(formatArea(0.0004)).toBe('0 m²')
    expect(formatArea(1e-9, 'ha')).toBe('0.00 ha')
    expect(formatArea(1.5e12)).toBe('1,500,000,000,000 m²')
    expect(formatArea(1.5e12, 'ha')).toBe('150,000,000.00 ha')
  })

  it('shows a missing value as an em dash', () => {
    expect(formatArea(null)).toBe(MISSING)
    expect(formatArea(undefined, 'ha')).toBe(MISSING)
  })

  it.each([-1, -0.0001, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(() => formatArea(value)).toThrow(RangeError)
  })
})

describe('formatLength', () => {
  it('shows m with 1 decimal and km with 2', () => {
    expect(formatLength(1370.02)).toBe('1,370.0 m')
    expect(formatLength(1370.02, 'km')).toBe('1.37 km')
    expect(formatLength(999.95)).toBe('1,000.0 m')
  })

  it('handles 0, very small and very large values', () => {
    expect(formatLength(0)).toBe('0.0 m')
    expect(formatLength(0.04)).toBe('0.0 m')
    expect(formatLength(0.004, 'km')).toBe('0.00 km')
    expect(formatLength(40_075_016.7, 'km')).toBe('40,075.02 km')
  })

  it('shows a missing value as an em dash and rejects negatives', () => {
    expect(formatLength(null)).toBe(MISSING)
    expect(() => formatLength(-5)).toThrow(RangeError)
  })
})

describe('formatNumber', () => {
  it('never shows negative zero', () => {
    expect(formatNumber(-0, 1)).toBe('0.0')
  })
})

describe('formatBytes', () => {
  it('uses binary units like the backend limit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1,023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(3068)).toBe('3.0 KB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB')
    expect(formatBytes(5 * 1024 ** 4)).toBe('5,120.0 GB')
  })

  it('shows a missing value as an em dash and rejects negatives', () => {
    expect(formatBytes(null)).toBe(MISSING)
    expect(() => formatBytes(-1)).toThrow(RangeError)
  })
})

describe('formatPercentDifference', () => {
  it('signs the difference of projected from geodesic', () => {
    expect(formatPercentDifference(232000.35, 231731.912)).toBe('+0.12%')
    expect(formatPercentDifference(99, 100)).toBe('−1.00%')
    expect(formatPercentDifference(100, 100)).toBe('0.00%')
  })

  it('does not show a sign for differences that round to zero', () => {
    expect(formatPercentDifference(100.001, 100)).toBe('0.00%')
    expect(formatPercentDifference(99.999, 100)).toBe('0.00%')
  })

  it('handles large ratios and missing or zero geodesic values', () => {
    expect(formatPercentDifference(1_000_000, 944_917)).toBe('+5.83%')
    expect(formatPercentDifference(1e12, 1)).toBe('+99,999,999,999,900.00%')
    expect(formatPercentDifference(null, 5)).toBe(MISSING)
    expect(formatPercentDifference(5, null)).toBe(MISSING)
    expect(formatPercentDifference(5, 0)).toBe(MISSING)
  })

  it('rejects negative measurements', () => {
    expect(() => formatPercentDifference(-1, 5)).toThrow(RangeError)
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-07T12:00:00Z')

  it.each([
    ['2026-10-07T11:59:30Z', 'just now'],
    ['2026-10-07T11:55:00Z', '5 minutes ago'],
    ['2026-10-07T11:00:00Z', '1 hour ago'],
    ['2026-10-06T12:00:00Z', 'yesterday'],
    ['2026-09-23T12:00:00Z', '2 weeks ago'],
    ['2025-10-07T12:00:00Z', 'last year'],
    ['2026-10-07T14:00:00Z', 'in 2 hours'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected)
  })

  it('shows missing or invalid dates as an em dash', () => {
    expect(formatRelativeTime(null, now)).toBe(MISSING)
    expect(formatRelativeTime('not a date', now)).toBe(MISSING)
  })
})

describe('formatDateTime', () => {
  it('formats in en-US medium date, short time', () => {
    expect(formatDateTime('2026-10-07T08:38:44.277511Z', 'UTC')).toBe('Oct 7, 2026, 8:38 AM')
    expect(formatDateTime('2026-10-07T08:38:44Z', 'Asia/Kolkata')).toBe('Oct 7, 2026, 2:08 PM')
  })

  it('shows missing or invalid dates as an em dash', () => {
    expect(formatDateTime(undefined)).toBe(MISSING)
    expect(formatDateTime('garbage')).toBe(MISSING)
  })
})

describe('statusLabel', () => {
  it('labels every file and measurement status', () => {
    expect(statusLabel('PENDING')).toBe('Queued')
    expect(statusLabel('PROCESSING')).toBe('Processing')
    expect(statusLabel('COMPLETED')).toBe('Completed')
    expect(statusLabel('FAILED')).toBe('Failed')
    expect(statusLabel('MEASURED')).toBe('Measured')
    expect(statusLabel('NOT_APPLICABLE')).toBe('Not applicable')
    expect(statusLabel('UNSUPPORTED')).toBe('Unsupported')
  })
})
