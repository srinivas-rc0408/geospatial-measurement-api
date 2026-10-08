/** Joins measurements and GeoJSON features into table rows, and the small pure helpers around them. */
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'

import type { Measurement, MeasurementStatus } from '@/lib/api/types'
import { formatArea, formatLength, type AreaUnit, type LengthUnit } from '@/lib/format'

export type Units = { area: AreaUnit; length: LengthUnit }

export type FeatureRow = {
  id: number
  /** From the feature's `name` attribute, when it has one. */
  name: string | null
  measurement: Measurement
  /** The feature in EPSG:4326 (geometry is null when it could not be converted). */
  feature: Feature<Geometry | null> | undefined
  /** Original attributes, in source order. */
  properties: [string, unknown][]
}

/** Keys the API adds to every exported GeoJSON feature; everything else is an original attribute. */
const MEASUREMENT_KEYS = new Set([
  '_feature_id',
  '_layer',
  '_geometry_type',
  '_status',
  '_measurement_crs',
  '_area_m2',
  '_area_hectares',
  '_perimeter_m',
  '_length_m',
  '_length_km',
  '_messages',
])

export function buildRows(
  measurements: Measurement[],
  geojson: FeatureCollection<Geometry | null> | undefined,
): FeatureRow[] {
  const features = new Map(geojson?.features.map((feature) => [Number(feature.id), feature]))
  return measurements.map((measurement) => {
    const feature = features.get(measurement.feature_id)
    const attributes: Record<string, unknown> = feature?.properties ?? {}
    const properties = Object.entries(attributes).filter(([key]) => !MEASUREMENT_KEYS.has(key))
    const name = properties.find(([key]) => key.toLowerCase() === 'name')?.[1]
    return {
      id: measurement.feature_id,
      name: typeof name === 'string' && name.trim() ? name : null,
      measurement,
      feature,
      properties,
    }
  })
}

export const rowName = (row: FeatureRow) => row.name ?? `Feature ${row.id + 1}`

/** "Polygon · Site boundaries": geometry type and layer, one line under the name. */
export const rowKind = (row: FeatureRow) =>
  [row.measurement.geometry_type, row.measurement.layer].filter(Boolean).join(' · ')

export type Sort = 'none' | 'ascending' | 'descending'
export const NEXT_SORT: Record<Sort, Sort> = {
  none: 'descending',
  descending: 'ascending',
  ascending: 'none',
}

export function needsAttention(status: MeasurementStatus): boolean {
  return status === 'FAILED' || status === 'UNSUPPORTED'
}

export type Filter = 'all' | 'measured' | 'attention'

export function matchesFilter(row: FeatureRow, filter: Filter): boolean {
  if (filter === 'measured') return row.measurement.status === 'MEASURED'
  if (filter === 'attention') return needsAttention(row.measurement.status)
  return true
}

/** Area for polygons, length for lines; null when the feature has neither. Used for sorting. */
export function mainValue(measurement: Measurement): number | null {
  return measurement.area_m2 ?? measurement.length_m ?? null
}

/** The row's headline measurement in the chosen units, e.g. "23.20 ha" or "363.8 m". */
export function formatMain(measurement: Measurement, units: Units): string {
  if (measurement.area_m2 != null) return formatArea(measurement.area_m2, units.area)
  return formatLength(measurement.length_m, units.length)
}

/** [west, south, east, north] of a geometry, or null if it has no coordinates. */
export function boundsOf(geometry: Geometry | null | undefined): [number, number, number, number] | null {
  if (!geometry) return null
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  const visit = (position: Position) => {
    const [x = NaN, y = NaN] = position
    bounds[0] = Math.min(bounds[0], x)
    bounds[1] = Math.min(bounds[1], y)
    bounds[2] = Math.max(bounds[2], x)
    bounds[3] = Math.max(bounds[3], y)
  }
  const walk = (geometry: Geometry) => {
    switch (geometry.type) {
      case 'Point':
        visit(geometry.coordinates)
        break
      case 'MultiPoint':
      case 'LineString':
        geometry.coordinates.forEach(visit)
        break
      case 'MultiLineString':
      case 'Polygon':
        geometry.coordinates.flat().forEach(visit)
        break
      case 'MultiPolygon':
        geometry.coordinates.flat(2).forEach(visit)
        break
      case 'GeometryCollection':
        geometry.geometries.forEach(walk)
    }
  }
  walk(geometry)
  return Number.isFinite(bounds[0]) ? bounds : null
}
