import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ResultsMapProps } from '@/features/results/ResultsMap'
import { FILE_ID, fileInfo, geojson, measurements } from '@/test/fixtures'
import { json, renderRoutes } from '@/test/render'

import Results from './Results'

// WebGL is not available in jsdom; the map is replaced by a stub that exposes its props.
vi.mock('@/features/results/ResultsMap', () => ({
  default: ({ selectedId, onSelect }: ResultsMapProps) => (
    <button
      type="button"
      data-testid="map"
      onClick={() => {
        onSelect(1)
      }}
    >
      map, selected {String(selectedId)}
    </button>
  ),
}))

let file: unknown
let fileStatus = 200
beforeEach(() => {
  file = fileInfo()
  fileStatus = 200
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname.endsWith('/measurements/')) return Promise.resolve(json(measurements))
      if (url.pathname.endsWith('/geojson/')) return Promise.resolve(json(geojson))
      return Promise.resolve(json(fileStatus === 200 ? file : { detail: 'not found' }, fileStatus))
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const show = () => renderRoutes([{ path: '/files/:id', Component: Results }], `/files/${FILE_ID}`)

describe('results page states', () => {
  it('explains an unknown file id', async () => {
    fileStatus = 404
    show()
    expect(await screen.findByRole('heading', { name: 'File not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload a file' })).toHaveAttribute('href', '/#upload')
  })

  it('shows the failure reason for a FAILED file', async () => {
    file = fileInfo({ status: 'FAILED', error: 'No readable layers.' })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('No readable layers.')
  })

  it('shows the processing steps when opened before the file is measured', async () => {
    file = fileInfo({ status: 'PROCESSING', processed_at: null })
    show()
    expect(await screen.findByText('Processing on the server')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Processing')
  })
})

describe('results workspace', () => {
  it('shows the header, totals and every feature', async () => {
    show()
    await screen.findByRole('button', { name: 'Copy API link' })
    const title = screen.getByRole('heading', { level: 1, name: 'mine_site_survey.kml' })
    expect(title.closest('header')).toHaveTextContent(/KML · Source CRS EPSG:4326 · 3 features · Processed/)
    expect(screen.getByText('23.20', { selector: '.sr-only' })).toBeInTheDocument()
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(within(table).getByText('23.20 ha')).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: 'Pit boundary' })).toBeInTheDocument()
  })

  it('filters, sorts and switches units', async () => {
    show()
    const table = await screen.findByRole('table')
    await userEvent.click(screen.getByRole('radio', { name: 'Needs attention' }))
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('Feature 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'All' }))
    const sortButton = within(table).getByRole('button', { name: /Measurement/ })
    await userEvent.click(sortButton)
    expect(within(table).getByRole('columnheader', { name: /Measurement/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    const names = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[1]?.textContent)
    expect(names()[0]).toMatch(/^Pit boundary/)
    expect(names()[2]).toMatch(/^Feature 3/) // no measurement: last

    await userEvent.click(screen.getByRole('radio', { name: 'm²' }))
    expect(within(table).getByText('232,000 m²')).toBeInTheDocument()
  })

  it('opens the detail sheet from a row, with the geodesic cross-check and properties in order', async () => {
    show()
    const table = await screen.findByRole('table')
    await userEvent.click(within(table).getByRole('button', { name: 'Pit boundary' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pit boundary' })
    expect(sheet).toHaveTextContent('Projected area23.20 ha')
    expect(sheet).toHaveTextContent('Geodesic area23.17 ha')
    expect(sheet).toHaveTextContent('Difference+0.12%')
    expect(sheet).toHaveTextContent('Measurement CRSEPSG:32643')
    expect(within(sheet).getByRole('button', { name: /^About geodesic area:/ })).toBeInTheDocument()
    const terms = within(sheet)
      .getAllByRole('term')
      .map((term) => term.textContent)
    expect(terms.slice(-3)).toEqual(['name', 'zone', 'surveyed_by'])
    expect(await screen.findByTestId('map')).toHaveTextContent('selected 0')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(within(table).getByRole('button', { name: 'Pit boundary' })).toHaveFocus()
  })

  it('selects a feature clicked on the map', async () => {
    show()
    await userEvent.click(await screen.findByTestId('map'))
    expect(await screen.findByRole('dialog', { name: 'Haul road' })).toBeInTheDocument()
  })

  it('copies the API link with a toast', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Copy API link' }))
    expect(writeText).toHaveBeenCalledWith(`http://api.test/api/files/${FILE_ID}`)
    expect(await screen.findByText('API link copied')).toBeInTheDocument()
  })
})
