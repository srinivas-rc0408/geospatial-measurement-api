import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { StatusPill } from '@/components/ui/StatusPill'

import { formatMain, NEXT_SORT, rowKind, rowName, type FeatureRow, type Sort, type Units } from './model'

const SORT_ICON = { none: ArrowUpDown, ascending: ArrowUp, descending: ArrowDown }

type MeasurementsTableProps = {
  rows: FeatureRow[]
  units: Units
  selectedId: number | null
  onSelect: (id: number) => void
  sort: Sort
  onSortChange: (sort: Sort) => void
}

/** From 734 px: hairline rows, sticky header, numbers right-aligned, sortable by measurement. */
export function MeasurementsTable({
  rows: visible,
  units,
  selectedId,
  onSelect,
  sort,
  onSortChange,
}: MeasurementsTableProps) {
  const setSort = onSortChange
  return (
    <table className="hidden w-full border-separate border-spacing-0 rounded-md border border-separator text-callout sm:table">
      <caption className="sr-only">
        Features and their measurements. Select a feature to see its details and show it on the map.
      </caption>
      <thead>
        <tr className="text-caption text-text-secondary">
          <th
            scope="col"
            className="sticky top-nav z-10 rounded-tl-md bg-bg-secondary px-3 py-2.5 text-right font-semibold"
          >
            #
          </th>
          <th scope="col" className="sticky top-nav z-10 bg-bg-secondary px-3 py-2.5 text-left font-semibold">
            Name
          </th>
          <th
            scope="col"
            aria-sort={sort}
            className="sticky top-nav z-10 bg-bg-secondary px-1 py-0.5 text-right font-semibold"
          >
            <button
              type="button"
              onClick={() => {
                setSort(NEXT_SORT[sort])
              }}
              className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-sm px-2 hover:text-text"
            >
              Measurement
              <Icon icon={SORT_ICON[sort]} size={14} />
              <span className="sr-only">, sort {NEXT_SORT[sort] === 'none' ? 'off' : NEXT_SORT[sort]}</span>
            </button>
          </th>
          <th
            scope="col"
            className="sticky top-nav z-10 rounded-tr-md bg-bg-secondary px-3 py-2.5 text-left font-semibold"
          >
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {visible.map((row) => {
          const selected = row.id === selectedId
          return (
            <tr
              key={row.id}
              aria-selected={selected}
              className={`relative transition-colors duration-150 ${selected ? 'bg-accent/8' : 'hover:bg-fill/60'}`}
            >
              <td className="border-t border-separator px-3 py-2 text-right text-text-secondary tabular-nums">
                {row.id + 1}
              </td>
              <td className="border-t border-separator px-3 py-2">
                {/* The button stretches over the whole row, so the row is one click/tap target. */}
                <button
                  type="button"
                  onClick={() => {
                    onSelect(row.id)
                  }}
                  className="text-left font-semibold after:absolute after:inset-0 after:content-['']"
                >
                  {rowName(row)}
                </button>
                <p className="text-caption text-text-secondary">{rowKind(row)}</p>
              </td>
              <td className="border-t border-separator px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {formatMain(row.measurement, units)}
              </td>
              <td className="border-t border-separator px-3 py-2">
                <StatusPill status={row.measurement.status} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
