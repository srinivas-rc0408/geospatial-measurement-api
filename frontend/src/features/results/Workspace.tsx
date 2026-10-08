import { useState } from 'react'

import { useGeoJson, useMeasurements } from '@/lib/api/hooks'
import type { FileInfo } from '@/lib/api/types'

import { FeatureSheet } from './FeatureSheet'
import { MapPanel } from './MapPanel'
import { MeasurementsPanel } from './MeasurementsPanel'
import { buildRows, formatMain, rowName, type Units } from './model'
import { ResultsHeader } from './ResultsHeader'
import { ResultsSkeleton, StateCard } from './ResultsStates'
import { StatsRow } from './StatsRow'

function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/geo+json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

export function Workspace({ file }: { file: FileInfo }) {
  const measurements = useMeasurements(file.id, true)
  const geojson = useGeoJson(file.id, true)
  const [units, setUnits] = useState<Units>({ area: 'ha', length: 'km' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  if (measurements.isPending) return <ResultsSkeleton file={file} />
  if (measurements.isError) {
    return (
      <StateCard
        tone="danger"
        title="The measurements could not be loaded"
        body={measurements.error.message}
        retry={() => void measurements.refetch()}
      />
    )
  }

  const rows = buildRows(measurements.data.items, geojson.data)
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null
  const select = (id: number) => {
    setSelectedId(id)
    setSheetOpen(true)
  }
  const describe = (id: number) => {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) return { title: `Feature ${id + 1}`, detail: '' }
    return {
      title: rowName(row),
      detail: [row.measurement.geometry_type, formatMain(row.measurement, units)].filter(Boolean).join(' · '),
    }
  }
  const download = geojson.data
    ? () => {
        const base = file.filename.replace(/\.[^.]+$/, '')
        saveFile(`${base}.geojson`, JSON.stringify(geojson.data))
      }
    : undefined

  return (
    <div className="flex flex-col gap-8">
      <ResultsHeader file={file} onDownload={download} />
      <StatsRow measurements={measurements.data} units={units} onUnitsChange={setUnits} />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-start">
        <MapPanel
          geojson={geojson}
          bbox={file.bbox ?? null}
          selectedId={selectedId}
          onSelect={select}
          describe={describe}
        />
        <div className="md:col-span-5">
          <MeasurementsPanel rows={rows} units={units} selectedId={selectedId} onSelect={select} />
        </div>
      </div>
      <FeatureSheet row={selectedRow} units={units} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
