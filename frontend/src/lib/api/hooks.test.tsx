import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './errors'
import { useHealthReady } from './hooks'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
    Promise.resolve(Response.json(body, { status })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useHealthReady', () => {
  it('calls /health/ready on the configured base URL and returns the body', async () => {
    const fetchMock = respond(200, { status: 'ok', database: 'ok' })
    const { result } = renderHook(() => useHealthReady(), { wrapper })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({ status: 'ok', database: 'ok' })
    expect(fetchMock.mock.calls[0]?.[0].url).toBe('http://api.test/health/ready')
  })

  it('reports a 503 as an ApiError', async () => {
    respond(503, { status: 'unavailable', database: 'unavailable' })
    const { result } = renderHook(() => useHealthReady(), { wrapper })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect((result.current.error as ApiError).status).toBe(503)
  })
})
