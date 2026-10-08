import { Copy, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Sheet } from '@/components/ui/Sheet'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/toastContext'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatArea, formatLength, formatPercentDifference, MISSING } from '@/lib/format'

import { rowKind, rowName, type FeatureRow, type Units } from './model'

const HELP = {
  projected: 'Measured on a flat map in the UTM zone of the feature’s own centre, where distortion is tiny.',
  geodesic:
    'Measured directly on the Earth’s curved surface (the WGS84 ellipsoid), with no map projection. An independent check.',
  difference: 'How far the projected value is from the geodesic one. Differences under 0.1% are typical.',
  crs: 'The coordinate reference system the measurement was made in. EPSG:32643, for example, is UTM zone 43N.',
}

function Term({ term, help }: { term: string; help: string }) {
  return (
    <dt className="flex items-center gap-1 text-callout text-text-secondary">
      {term}
      <Tooltip content={help}>
        <button
          type="button"
          aria-label={`About ${term.toLowerCase()}: ${help}`}
          className="-my-2.5 flex size-11 items-center justify-center rounded-full text-text-tertiary hover:text-text"
        >
          <Icon icon={Info} size={14} />
        </button>
      </Tooltip>
    </dt>
  )
}

function Row({ term, help, children }: { term: string; help?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-separator py-2.5 first:border-t-0">
      {help ? <Term term={term} help={help} /> : <dt className="text-callout text-text-secondary">{term}</dt>}
      <dd className="text-right text-callout text-text tabular-nums">{children}</dd>
    </div>
  )
}

function showValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return MISSING
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return JSON.stringify(value)
}

type FeatureSheetProps = {
  row: FeatureRow | null
  units: Units
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeatureSheet({ row, units, open, onOpenChange }: FeatureSheetProps) {
  const toast = useToast()
  if (!row) return null
  const { measurement } = row
  const isArea = measurement.area_m2 != null
  const geodesic = isArea ? measurement.geodesic?.area_m2 : measurement.geodesic?.length_m
  const projected = isArea ? measurement.area_m2 : measurement.length_m
  const format = (value: number | null | undefined) =>
    isArea ? formatArea(value, units.area) : formatLength(value, units.length)

  async function copyGeoJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row?.feature, null, 2))
      toast('GeoJSON copied')
    } catch {
      toast('Could not copy. Your browser blocked clipboard access.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={rowName(row)} description={rowKind(row)}>
      <div className="flex flex-col gap-6">
        <div>
          <StatusPill status={measurement.status} />
        </div>

        {projected != null && (
          <section aria-label="Measurement">
            <dl className="rounded-md bg-surface px-4">
              <Row term={isArea ? 'Projected area' : 'Projected length'} help={HELP.projected}>
                {format(projected)}
              </Row>
              {isArea && measurement.perimeter_m != null && (
                <Row term="Perimeter">{formatLength(measurement.perimeter_m, units.length)}</Row>
              )}
              <Row term={isArea ? 'Geodesic area' : 'Geodesic length'} help={HELP.geodesic}>
                {format(geodesic)}
              </Row>
              <Row term="Difference" help={HELP.difference}>
                {formatPercentDifference(projected, geodesic)}
              </Row>
              <Row term="Measurement CRS" help={HELP.crs}>
                {measurement.measurement_crs ?? MISSING}
              </Row>
            </dl>
          </section>
        )}

        {measurement.messages && measurement.messages.length > 0 && (
          <section aria-labelledby="feature-messages" className="flex flex-col gap-2">
            <h3 id="feature-messages" className="text-callout font-semibold">
              Messages
            </h3>
            <ul className="flex flex-col gap-1.5 text-callout text-text-secondary">
              {measurement.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="feature-properties" className="flex flex-col gap-2">
          <h3 id="feature-properties" className="text-callout font-semibold">
            Properties
          </h3>
          {row.properties.length === 0 ? (
            <p className="text-callout text-text-secondary">This feature has no attributes.</p>
          ) : (
            <dl className="rounded-md bg-surface px-4">
              {row.properties.map(([key, value]) => (
                <Row key={key} term={key}>
                  <span className="break-all">{showValue(value)}</span>
                </Row>
              ))}
            </dl>
          )}
        </section>

        {row.feature && (
          <Button variant="secondary" className="self-start" onClick={() => void copyGeoJson()}>
            <Icon icon={Copy} size={18} />
            Copy GeoJSON
          </Button>
        )}
      </div>
    </Sheet>
  )
}
