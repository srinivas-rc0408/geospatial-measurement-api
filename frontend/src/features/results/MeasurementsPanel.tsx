import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatNumber } from '@/lib/format'

import { MeasurementCards } from './MeasurementCards'
import { MeasurementsTable } from './MeasurementsTable'
import { mainValue, matchesFilter, type FeatureRow, type Filter, type Sort, type Units } from './model'

export const PAGE_SIZE = 100

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'measured', label: 'Measured' },
  { value: 'attention', label: 'Needs attention' },
] as const satisfies readonly { value: Filter; label: string }[]

type MeasurementsPanelProps = {
  rows: FeatureRow[]
  units: Units
  selectedId: number | null
  onSelect: (id: number) => void
}

export function MeasurementsPanel({ rows, units, selectedId, onSelect }: MeasurementsPanelProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('none')
  const [page, setPage] = useState(0)

  const filtered = rows.filter((row) => matchesFilter(row, filter))
  // Features without a measurement (points, failures) sort last in both directions.
  const sorted =
    sort === 'none'
      ? filtered
      : [...filtered].sort((a, b) => {
          const left = mainValue(a.measurement)
          const right = mainValue(b.measurement)
          if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
          return sort === 'ascending' ? left - right : right - left
        })
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <section aria-labelledby="measurements-title" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 id="measurements-title" className="text-title-3">
          Measurements
        </h2>
        <SegmentedControl
          label="Show features"
          options={FILTERS}
          value={filter}
          onChange={(value) => {
            setFilter(value)
            setPage(0)
          }}
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-8 text-center text-callout text-text-secondary">
          No features match this filter.
        </p>
      ) : (
        <>
          <MeasurementsTable
            rows={visible}
            units={units}
            selectedId={selectedId}
            onSelect={onSelect}
            sort={sort}
            onSortChange={setSort}
          />
          <MeasurementCards rows={visible} units={units} selectedId={selectedId} onSelect={onSelect} />
        </>
      )}

      {pages > 1 && (
        <nav
          aria-label="Pages"
          className="flex items-center justify-between gap-3 text-caption text-text-secondary"
        >
          <Button
            variant="secondary"
            disabled={current === 0}
            onClick={() => {
              setPage(current - 1)
            }}
          >
            Previous
          </Button>
          <span aria-live="polite">
            {formatNumber(current * PAGE_SIZE + 1, 0)}–
            {formatNumber(Math.min((current + 1) * PAGE_SIZE, sorted.length), 0)} of{' '}
            {formatNumber(sorted.length, 0)}
          </span>
          <Button
            variant="secondary"
            disabled={current === pages - 1}
            onClick={() => {
              setPage(current + 1)
            }}
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  )
}
