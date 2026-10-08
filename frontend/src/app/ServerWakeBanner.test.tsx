import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SLOW_REQUEST_MS } from '@/lib/api/serverWaking'

import { ServerWakeBanner } from './ServerWakeBanner'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ServerWakeBanner', () => {
  it('pings /health/ready on load and explains a slow answer until the server responds', async () => {
    vi.useFakeTimers()
    let answer: (response: Response) => void = () => undefined
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)))
    vi.stubGlobal('fetch', fetch)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ServerWakeBanner />
      </QueryClientProvider>,
    )
    expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe('http://api.test/health/ready')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_MS)
    })
    expect(screen.getByRole('status')).toHaveTextContent(/Waking up the server/)

    await act(async () => {
      answer(new Response(JSON.stringify({ status: 'ok', database: 'ok' })))
      await vi.runAllTimersAsync()
    })
    expect(screen.getByRole('status')).not.toHaveTextContent(/Waking up/)
  })
})
