/**
 * The results map. Lazy-loaded (MapLibre is large), so it is a default export used via React.lazy.
 * Draws the file's EPSG:4326 GeoJSON over OpenFreeMap tiles, follows the app theme, and keeps the
 * selected feature in sync with the table (selection → fly to it; click on the map → select).
 */
import 'maplibre-gl/dist/maplibre-gl.css'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

import { Scan } from 'lucide-react'
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type LayerSpecification,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type TransformStyleFunction,
} from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'

import { Icon } from '@/components/ui/Icon'

import { boundsOf } from './model'

const STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const
// MapLibre finds its worker next to its own module, which bundlers move; point it at the emitted file.
setWorkerUrl(workerUrl)

const SOURCE = 'features'
const INTERACTIVE_LAYERS = ['features-fill', 'features-line', 'features-point']
const PADDING = 48
const MAX_ZOOM = 17

type Theme = keyof typeof STYLES

/**
 * OpenFreeMap's road-shield layers compare `ref_length` without a default, and many roads have none,
 * so MapLibre logs a warning per tile. A coalesce default makes those roads simply not match.
 */
const patchStyle: TransformStyleFunction = (_previous, next) => ({
  ...next,
  layers: next.layers.map((layer) =>
    'filter' in layer && JSON.stringify(layer.filter).includes('"ref_length"')
      ? {
          ...layer,
          filter: JSON.parse(
            JSON.stringify(layer.filter).replaceAll(
              '["get","ref_length"]',
              '["coalesce",["get","ref_length"],99]',
            ),
          ) as FilterSpecification,
        }
      : layer,
  ),
})
const loadStyle = (map: MapLibreMap) => {
  map.setStyle(STYLES[currentTheme()], { transformStyle: patchStyle, validate: false })
}
const currentTheme = (): Theme => (document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark')
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export type ResultsMapProps = {
  geojson: FeatureCollection<Geometry | null>
  /** [minLon, minLat, maxLon, maxLat] of the whole file, or null if nothing has a geometry. */
  bbox: number[] | null
  selectedId: number | null
  onSelect: (id: number) => void
  /** Tooltip text for a feature: name / type, and its main measurement. */
  describe: (id: number) => { title: string; detail: string }
}

/** Map colours come from the design tokens, read when a style loads (theme switches reload it). */
function addDataLayers(map: MapLibreMap, data: FeatureCollection) {
  const css = getComputedStyle(document.documentElement)
  const accent = css.getPropertyValue('--accent').trim()
  const neutral = css.getPropertyValue('--neutral-dot').trim()
  const color: ExpressionSpecification = [
    'case',
    ['in', ['get', '_status'], ['literal', ['FAILED', 'UNSUPPORTED']]],
    neutral,
    accent,
  ]
  const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false]
  const hover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false]
  const polygons: FilterSpecification = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]]
  const lines: FilterSpecification = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]
  const points: FilterSpecification = ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]]

  map.addSource(SOURCE, { type: 'geojson', data })
  const layers: LayerSpecification[] = [
    {
      id: 'features-fill',
      type: 'fill',
      source: SOURCE,
      filter: polygons,
      paint: { 'fill-color': color, 'fill-opacity': ['case', selected, 0.4, hover, 0.28, 0.18] },
    },
    {
      id: 'features-outline',
      type: 'line',
      source: SOURCE,
      filter: polygons,
      paint: { 'line-color': color, 'line-width': ['case', selected, 4, 2] },
    },
    {
      id: 'features-line',
      type: 'line',
      source: SOURCE,
      filter: lines,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': ['case', selected, 5, hover, 4, 3] },
    },
    {
      id: 'features-point',
      type: 'circle',
      source: SOURCE,
      filter: points,
      paint: {
        'circle-radius': ['case', selected, 9, 7],
        'circle-color': '#ffffff',
        'circle-stroke-color': color,
        'circle-stroke-width': ['case', selected, 3, 2],
      },
    },
  ]
  layers.forEach((layer) => {
    map.addLayer(layer)
  })
}

export default function ResultsMap({ geojson, bbox, selectedId, onSelect, describe }: ResultsMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [hovered, setHovered] = useState<{ id: number; x: number; y: number } | null>(null)
  // Latest callbacks and selection for the map's event handlers, which are attached once.
  const latest = useRef({ onSelect, selectedId })
  useEffect(() => {
    latest.current = { onSelect, selectedId }
  })

  const fileBounds = bbox?.length === 4 ? (bbox as unknown as LngLatBoundsLike) : null

  function fitToData(animate: boolean) {
    const map = mapRef.current
    if (!map || !fileBounds) return
    map.fitBounds(fileBounds, {
      padding: PADDING,
      maxZoom: MAX_ZOOM,
      duration: animate && !reducedMotion() ? 1000 : 0,
    })
  }

  useEffect(() => {
    const element = container.current
    if (!element) return
    let destroy: (() => void) | undefined

    // Built in a task of its own, after the page has painted: MapLibre's setup is one long task,
    // and splitting it from the module's evaluation keeps the page responsive while the map loads.
    const timer = setTimeout(() => {
      // Features without a WGS84 geometry cannot be drawn (they are still listed in the table).
      const data = {
        ...geojson,
        features: geojson.features.filter((feature) => feature.geometry !== null),
      } as FeatureCollection
      const map = new MapLibreMap({
        container: element,
        attributionControl: { compact: false },
        // On touch screens one finger scrolls the page; two fingers move the map.
        cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
        ...(fileBounds
          ? { bounds: fileBounds, fitBoundsOptions: { padding: PADDING, maxZoom: MAX_ZOOM } }
          : { zoom: 1 }),
      })
      mapRef.current = map
      loadStyle(map)
      // The basemap styles reference a few decorative patterns their sprite lacks (e.g. "wood-pattern");
      // a transparent pixel draws nothing instead of logging a warning per tile.
      map.setMissingStyleImageResolver((id) => {
        if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) })
      })
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

      // Start slightly zoomed out, then ease onto the data: the viewer sees where the site is.
      if (fileBounds && !reducedMotion()) map.setZoom(map.getZoom() - 1.5)

      map.on('style.load', () => {
        addDataLayers(map, data)
        const { selectedId: selected } = latest.current
        if (selected !== null) map.setFeatureState({ source: SOURCE, id: selected }, { selected: true })
      })
      map.once('load', () => {
        fitToData(true)
      })

      let hoverId: number | null = null
      const setHover = (id: number | null) => {
        if (hoverId !== null) map.setFeatureState({ source: SOURCE, id: hoverId }, { hover: false })
        hoverId = id
        if (id !== null) map.setFeatureState({ source: SOURCE, id }, { hover: true })
      }
      const featureAt = (features: MapGeoJSONFeature[] | undefined) => {
        const id = features?.[0]?.id
        return typeof id === 'number' ? id : null
      }
      map.on('mousemove', INTERACTIVE_LAYERS, (event) => {
        const id = featureAt(event.features)
        map.getCanvas().style.cursor = 'pointer'
        setHover(id)
        setHovered(id === null ? null : { id, x: event.point.x, y: event.point.y })
      })
      map.on('mouseleave', INTERACTIVE_LAYERS, () => {
        map.getCanvas().style.cursor = ''
        setHover(null)
        setHovered(null)
      })
      map.on('click', INTERACTIVE_LAYERS, (event) => {
        const id = featureAt(event.features)
        if (id !== null) latest.current.onSelect(id)
      })

      // Follow the app theme: swap the basemap, then style.load re-adds our layers.
      const observer = new MutationObserver(() => {
        loadStyle(map)
      })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

      destroy = () => {
        observer.disconnect()
        map.remove()
        mapRef.current = null
      }
    }, 0)

    return () => {
      clearTimeout(timer)
      destroy?.()
    }
    // The map is created once per file; selection and hover are handled by the effects/handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson])

  // Selection: highlight it, and fly to it so a row click shows the feature on the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || selectedId === null) return
    const apply = () => {
      map.setFeatureState({ source: SOURCE, id: selectedId }, { selected: true })
      const feature = geojson.features.find((candidate) => Number(candidate.id) === selectedId)
      const bounds = boundsOf(feature?.geometry)
      if (bounds) {
        map.fitBounds(bounds, {
          padding: PADDING * 2,
          maxZoom: MAX_ZOOM,
          duration: reducedMotion() ? 0 : 800,
        })
      }
    }
    if (map.getSource(SOURCE)) apply()
    else map.once('style.load', apply)
    return () => {
      if (map.getSource(SOURCE)) map.setFeatureState({ source: SOURCE, id: selectedId }, { selected: false })
    }
  }, [selectedId, geojson])

  const tooltip = hovered ? describe(hovered.id) : null

  return (
    <div className="relative size-full">
      <div
        ref={container}
        role="region"
        aria-label="Map of the file’s features. The measurements list shows the same features."
        className="size-full"
      />
      {fileBounds && (
        <button
          type="button"
          onClick={() => {
            fitToData(true)
          }}
          aria-label="Fit the map to the data"
          title="Fit to data"
          className="absolute top-2.5 left-2.5 flex size-11 items-center justify-center rounded-md border border-separator bg-nav-glass text-text shadow-card backdrop-blur-glass hover:bg-surface-elevated"
        >
          <Icon icon={Scan} />
        </button>
      )}
      {tooltip && hovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 flex max-w-60 -translate-x-1/2 -translate-y-full flex-col rounded-md border border-separator bg-nav-glass px-3 py-2 text-caption shadow-card backdrop-blur-glass"
          style={{ left: hovered.x, top: hovered.y - 12 }}
        >
          <span className="font-semibold text-text">{tooltip.title}</span>
          <span className="text-text-secondary">{tooltip.detail}</span>
        </div>
      )}
    </div>
  )
}
