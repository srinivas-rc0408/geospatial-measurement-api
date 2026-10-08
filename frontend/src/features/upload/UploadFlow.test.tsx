import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadFile } from '@/lib/api/upload'
import Home from '@/pages/Home'
import { json, renderRoutes } from '@/test/render'

vi.mock('@/lib/api/upload', () => ({ uploadFile: vi.fn() }))

const ID = '9f69fdac523d4233a88b21b0ca504506'
const info = (status: string, extra: object = {}) => ({
  id: ID,
  filename: 'site.kml',
  file_type: 'KML',
  size_bytes: 6,
  status,
  crs: null,
  feature_count: 7,
  created_at: '2026-10-08T00:00:00Z',
  processed_at: null,
  ...extra,
})

let fileStatus: object
beforeEach(() => {
  fileStatus = info('COMPLETED')
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.startsWith('/samples/')) return Promise.resolve(new Response('<kml/>'))
      if (url.endsWith(`/api/files/${ID}`)) return Promise.resolve(json(fileStatus))
      return Promise.resolve(json({ status: 'ok', database: 'ok' }))
    }),
  )
  vi.mocked(uploadFile).mockImplementation((_file, onProgress) => {
    onProgress(0.4)
    return Promise.resolve(info('PENDING') as never)
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(uploadFile).mockReset()
})

const routes = [
  { path: '/', Component: Home },
  { path: '/files/:id', Component: () => <h1>Results page</h1> },
]

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Choose a file to measure'), { target: { files: [file] } })
}

describe('upload flow', () => {
  it('uploads a chosen file, shows progress, then toasts and opens the results when measured', async () => {
    const { router } = renderRoutes(routes, '/')
    chooseFile(new File(['<kml/>'], 'site.kml'))
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledOnce()
    })
    expect(await screen.findByText('Measured · opening the results')).toBeInTheDocument()
    expect(screen.getByText(/Uploaded/)).toHaveTextContent('(done)')
    expect(
      await screen.findByText('Measured site.kml · 7 features', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/files/${ID}`)
    })
  })

  it('rejects an unsupported file without uploading it', () => {
    renderRoutes(routes, '/')
    chooseFile(new File(['x'], 'notes.txt'))
    expect(screen.getByRole('alert')).toHaveTextContent('“notes.txt” is not a supported file type.')
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('accepts a dropped file, and asks for one file at a time', async () => {
    renderRoutes(routes, '/')
    const zone = screen.getByText('Drop a .zip, .kml or .kmz here').closest('[class*="border-dashed"]')
    if (!zone) throw new Error('drop zone not found')
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['a'], 'a.kml'), new File(['b'], 'b.kml')] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Drop one file at a time.')
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['a'], 'a.kml')] } })
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledOnce()
    })
  })

  it('shows the server reason when processing fails, and lets the user start again', async () => {
    fileStatus = info('FAILED', { error: 'No readable layers in the KML.' })
    renderRoutes(routes, '/')
    chooseFile(new File(['<kml/>'], 'site.kml'))
    expect(await screen.findByRole('alert')).toHaveTextContent('No readable layers in the KML.')
    await userEvent.click(screen.getByRole('button', { name: 'Try another file' }))
    expect(screen.getByText('Drop a .zip, .kml or .kmz here')).toBeInTheDocument()
  })

  it('measures a sample through the same flow', async () => {
    renderRoutes(routes, '/')
    await userEvent.click(screen.getByRole('button', { name: 'Measure the Web Mercator trap sample' }))
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledOnce()
    })
    expect(vi.mocked(uploadFile).mock.calls[0]?.[0].name).toBe('web_mercator_square.zip')
  })
})
