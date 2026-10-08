import { Card } from '@/components/ui/Card'
import { CountUp } from '@/components/ui/CountUp'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Stat } from '@/components/ui/Stat'
import type { MeasurementList } from '@/lib/api/types'
import {
  AREA_UNIT_LABEL,
  formatAreaValue,
  formatLengthValue,
  formatNumber,
  LENGTH_UNIT_LABEL,
  type AreaUnit,
  type LengthUnit,
} from '@/lib/format'

import type { Units } from './model'

const AREA_OPTIONS = [
  { value: 'ha', label: 'ha' },
  { value: 'm2', label: 'm²' },
] as const satisfies readonly { value: AreaUnit; label: string }[]
const LENGTH_OPTIONS = [
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
] as const satisfies readonly { value: LengthUnit; label: string }[]

type StatsRowProps = {
  measurements: MeasurementList
  units: Units
  onUnitsChange: (units: Units) => void
}

/** Whole-file totals. The unit toggles also switch the units in the measurements list. */
export function StatsRow({ measurements, units, onUnitsChange }: StatsRowProps) {
  const { summary, total } = measurements
  const byStatus = summary.by_status
  const attention = (byStatus['FAILED'] ?? 0) + (byStatus['UNSUPPORTED'] ?? 0)
  const formatCount = (value: number) => formatNumber(value, 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <Stat
            label="Total area"
            value={
              <CountUp
                key={units.area}
                value={summary.total_area_m2}
                format={(value) => formatAreaValue(value, units.area)}
              />
            }
            unit={AREA_UNIT_LABEL[units.area]}
          />
        </div>
        <SegmentedControl
          label="Area unit"
          options={AREA_OPTIONS}
          value={units.area}
          onChange={(area) => {
            onUnitsChange({ ...units, area })
          }}
        />
      </Card>
      <Card className="flex flex-col gap-4">
        <Stat
          label="Total length"
          value={
            <CountUp
              key={units.length}
              value={summary.total_length_m}
              format={(value) => formatLengthValue(value, units.length)}
            />
          }
          unit={LENGTH_UNIT_LABEL[units.length]}
        />
        <SegmentedControl
          label="Length unit"
          options={LENGTH_OPTIONS}
          value={units.length}
          onChange={(length) => {
            onUnitsChange({ ...units, length })
          }}
        />
      </Card>
      <Card>
        <Stat
          label="Measured"
          value={<CountUp value={byStatus['MEASURED'] ?? 0} format={formatCount} />}
          unit={`of ${formatCount(total)}`}
        />
      </Card>
      <Card>
        <Stat label="Needs attention" value={<CountUp value={attention} format={formatCount} />} />
        <p className="mt-2 text-caption text-text-secondary">Failed or unsupported features</p>
      </Card>
    </div>
  )
}
