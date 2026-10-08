import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fileInfo } from '@/test/fixtures'
import { json, renderRoutes } from '@/test/render'

import Files from './Files'

let files: unknown[]
let deleteStatus = 204
const fetchMock = vi.fn((request: Request) => {
  if (request.method === 'DELETE') {
    if (deleteStatus === 204) files = []
    return Promise.resolve(
      deleteStatus === 204
        ? new Response(null, { status: 204 })
        : json({ detail: 'File is being processed; try again shortly.' }, deleteStatus),
    )
  }
  return Promise.resolve(json({ total: files.length, limit: 20, offset: 0, items: files }))
})

beforeEach(() => {
  files = [fileInfo({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() })]
  deleteStatus = 204
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockClear()
})

const show = () => renderRoutes([{ path: '/files', Component: Files }], '/files')

/** The table's delete button (the mobile card list renders one too; jsdom applies no media queries). */
async function deleteButton() {
  const [button] = await screen.findAllByRole('button', { name: 'Delete mine_site_survey.kml' })
  if (!button) throw new Error('no delete button')
  return button
}

describe('files history', () => {
  it('lists files with status, feature count, total area and relative time; each opens its results', async () => {
    show()
    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]
    if (!row) throw new Error('no row')
    expect(within(row).getByRole('link', { name: 'mine_site_survey.kml' })).toHaveAttribute(
      'href',
      '/files/9f69fdac523d4233a88b21b0ca504506',
    )
    expect(row).toHaveTextContent('Completed')
    expect(row).toHaveTextContent('5 minutes ago')
    expect(await within(row).findByText('23.20 ha')).toBeInTheDocument()
    // Totals come with the list: no request per file.
    expect(fetchMock.mock.calls.some(([request]) => request.url.includes('/measurements/'))).toBe(false)
  })

  it('shows a friendly empty state with a way to upload', async () => {
    files = []
    show()
    expect(await screen.findByRole('heading', { name: 'No files yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upload a file' })).toHaveAttribute('href', '/#upload')
  })

  it('deletes after confirmation, with a toast', async () => {
    show()
    await userEvent.click(await deleteButton())
    const sheet = await screen.findByRole('dialog', { name: 'Delete mine_site_survey.kml?' })
    expect(sheet).toHaveTextContent('This cannot be undone.')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete file' }))
    expect(await screen.findByText('Deleted mine_site_survey.kml')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([request]) => request.method === 'DELETE')).toBe(true)
    expect(await screen.findByRole('heading', { name: 'No files yet' })).toBeInTheDocument()
  })

  it('keeps the file when cancelled, and explains a refused delete', async () => {
    show()
    await userEvent.click(await deleteButton())
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(fetchMock.mock.calls.some(([request]) => request.method === 'DELETE')).toBe(false)

    deleteStatus = 409
    await userEvent.click(await deleteButton())
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete file' }),
    )
    expect(
      await screen.findByText(
        'Could not delete mine_site_survey.kml. File is being processed; try again shortly.',
      ),
    ).toBeInTheDocument()
  })
})
