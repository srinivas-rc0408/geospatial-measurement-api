/** Response shapes copied from the real API (mine_site_survey.kml), trimmed for tests. */
import type { FeatureCollection, Geometry } from 'geojson'

import type { FileInfo, Measurement, MeasurementList } from '@/lib/api/types'

export const FILE_ID = '9f69fdac523d4233a88b21b0ca504506'

export const fileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  id: FILE_ID,
  filename: 'mine_site_survey.kml',
  file_type: 'KML',
  size_bytes: 3068,
  status: 'COMPLETED',
  crs: 'EPSG:4326',
  feature_count: 3,
  geometry_types: { Polygon: 1, LineString: 1, Point: 1 },
  bbox: [77.59, 12.974, 77.598, 12.981],
  warnings: [],
  error: null,
  created_at: '2026-10-08T03:30:00Z',
  processed_at: '2026-10-08T03:30:01Z',
  ...overrides,
})

const measurement = (overrides: Partial<Measurement>): Measurement => ({
  feature_id: 0,
  layer: 'Site boundaries',
  geometry_type: 'Polygon',
  status: 'MEASURED',
  measurement_crs: 'EPSG:32643',
  area_m2: null,
  area_hectares: null,
  perimeter_m: null,
  length_m: null,
  length_km: null,
  geodesic: null,
  messages: [],
  ...overrides,
})

export const measurements: MeasurementList = {
  file_id: FILE_ID,
  crs: 'EPSG:4326',
  units: { area: 'square metres (m²)', length: 'metres (m)' },
  summary: {
    total_area_m2: 232000.35,
    total_area_hectares: 23.200035,
    total_length_m: 363.79,
    total_length_km: 0.36379,
    by_status: { MEASURED: 2, NOT_APPLICABLE: 0, UNSUPPORTED: 1, FAILED: 0 },
  },
  total: 3,
  limit: 3,
  offset: 0,
  items: [
    measurement({
      feature_id: 0,
      area_m2: 232000.35,
      area_hectares: 23.200035,
      perimeter_m: 2360.002,
      geodesic: { area_m2: 231731.912, length_m: null },
    }),
    measurement({
      feature_id: 1,
      layer: 'Infrastructure',
      geometry_type: 'LineString',
      length_m: 363.79,
      length_km: 0.36379,
      geodesic: { area_m2: null, length_m: 363.5 },
    }),
    measurement({
      feature_id: 2,
      layer: 'Infrastructure',
      geometry_type: 'Model',
      status: 'UNSUPPORTED',
      measurement_crs: null,
      messages: ['KML <Model> geometry is not supported for measurement.'],
    }),
  ],
}

export const geojson: FeatureCollection<Geometry | null> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 0,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.590223, 12.976826],
            [77.59575, 12.976771],
            [77.595787, 12.980384],
            [77.59026, 12.980439],
            [77.590223, 12.976826],
          ],
        ],
      },
      properties: {
        name: 'Pit boundary',
        zone: 'North pit',
        surveyed_by: 'Drone-07',
        _feature_id: 0,
        _status: 'MEASURED',
      },
    },
    {
      type: 'Feature',
      id: 1,
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.5958, 12.978],
          [77.5968, 12.9772],
        ],
      },
      properties: { name: 'Haul road', _feature_id: 1, _status: 'MEASURED' },
    },
    { type: 'Feature', id: 2, geometry: null, properties: { _feature_id: 2, _status: 'UNSUPPORTED' } },
  ],
}
