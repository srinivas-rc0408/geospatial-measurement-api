import { describe, expect, it } from 'vitest'

import { geojson, measurements } from '@/test/fixtures'

import { boundsOf, buildRows, formatMain, mainValue, matchesFilter, rowKind, rowName } from './model'

const rows = buildRows(measurements.items, geojson)

describe('buildRows', () => {
  it('joins measurements with features by id and keeps original attributes in source order', () => {
    const [pit] = rows
    expect(pit?.name).toBe('Pit boundary')
    expect(pit?.properties).toEqual([
      ['name', 'Pit boundary'],
      ['zone', 'North pit'],
      ['surveyed_by', 'Drone-07'],
    ])
    expect(pit?.feature?.id).toBe(0)
  })

  it('falls back to a numbered name and works before the GeoJSON has loaded', () => {
    expect(rows[2] && rowName(rows[2])).toBe('Feature 3')
    const early = buildRows(measurements.items, undefined)
    expect(early[0]?.name).toBeNull()
    expect(early[0]?.feature).toBeUndefined()
  })

  it('describes the row kind as type · layer', () => {
    expect(rows[1] && rowKind(rows[1])).toBe('LineString · Infrastructure')
  })
})

describe('filters and measurements', () => {
  it('filters measured and needs-attention features', () => {
    expect(rows.filter((row) => matchesFilter(row, 'measured')).map((row) => row.id)).toEqual([0, 1])
    expect(rows.filter((row) => matchesFilter(row, 'attention')).map((row) => row.id)).toEqual([2])
    expect(rows.filter((row) => matchesFilter(row, 'all'))).toHaveLength(3)
  })

  it('formats the main measurement in the chosen units', () => {
    const [pit, road, model] = measurements.items
    if (!pit || !road || !model) throw new Error('fixture')
    expect(formatMain(pit, { area: 'm2', length: 'm' })).toBe('232,000 m²')
    expect(formatMain(pit, { area: 'ha', length: 'm' })).toBe('23.20 ha')
    expect(formatMain(road, { area: 'ha', length: 'km' })).toBe('0.36 km')
    expect(formatMain(model, { area: 'ha', length: 'km' })).toBe('—')
    expect(mainValue(model)).toBeNull()
  })
})

describe('boundsOf', () => {
  it('returns [west, south, east, north] for any geometry, null when there is none', () => {
    expect(boundsOf({ type: 'Point', coordinates: [1, 2] })).toEqual([1, 2, 1, 2])
    expect(
      boundsOf({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [0, 0],
              [2, 0],
              [2, 3],
              [0, 0],
            ],
          ],
          [
            [
              [-1, 5],
              [1, 5],
              [1, 6],
              [-1, 5],
            ],
          ],
        ],
      }),
    ).toEqual([-1, 0, 2, 6])
    expect(
      boundsOf({
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [4, 4] },
          {
            type: 'LineString',
            coordinates: [
              [-4, 1],
              [0, 9],
            ],
          },
        ],
      }),
    ).toEqual([-4, 1, 4, 9])
    expect(boundsOf(null)).toBeNull()
    expect(boundsOf({ type: 'GeometryCollection', geometries: [] })).toBeNull()
  })
})
