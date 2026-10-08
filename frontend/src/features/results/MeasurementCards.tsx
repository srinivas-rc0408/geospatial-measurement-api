import { StatusPill } from '@/components/ui/StatusPill'

import { formatMain, rowKind, rowName, type FeatureRow, type Units } from './model'

type MeasurementCardsProps = {
  rows: FeatureRow[]
  units: Units
  selectedId: number | null
  onSelect: (id: number) => void
}

/** Below 734 px a card per feature replaces the table, so nothing ever scrolls sideways. */
export function MeasurementCards({ rows: visible, units, selectedId, onSelect }: MeasurementCardsProps) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden" aria-label="Features">
      {visible.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            aria-current={row.id === selectedId || undefined}
            onClick={() => {
              onSelect(row.id)
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left transition-colors duration-150 ${row.id === selectedId ? 'bg-accent/8' : 'bg-surface hover:bg-surface-elevated'}`}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">{rowName(row)}</span>
              <span className="truncate text-caption text-text-secondary">{rowKind(row)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-callout tabular-nums">{formatMain(row.measurement, units)}</span>
              <StatusPill status={row.measurement.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
