import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWithTimeout, readApiBaseUrl, unwrap } from './client'
import { ApiError, NetworkError } from './errors'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('readApiBaseUrl', () => {
  it('accepts http(s) URLs and drops trailing slashes', () => {
    expect(readApiBaseUrl('http://localhost:8000')).toBe('http://localhost:8000')
    expect(readApiBaseUrl(' https://api.example.com/ ')).toBe('https://api.example.com')
  })

  it.each([undefined, '', '   '])('rejects a missing value (%j) with a fix-it message', (value) => {
    expect(() => readApiBaseUrl(value)).toThrow(/VITE_API_BASE_URL is missing.*\.env\.example/)
  })

  it('rejects malformed and non-http URLs', () => {
    expect(() => readApiBaseUrl('localhost:8000')).toThrow(/must start with http/)
    expect(() => readApiBaseUrl('not a url')).toThrow(/not a valid URL/)
  })
})

describe('fetchWithTimeout', () => {
  it('returns the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
    )
    const response = await fetchWithTimeout(new Request('http://api.test/health'))
    expect(response.status).toBe(200)
  })

  it('turns a transport failure into NetworkError("offline")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const error: unknown = await fetchWithTimeout(new Request('http://api.test/health')).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).reason).toBe('offline')
  })

  it('turns an expired timeout into NetworkError("timeout")', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(new DOMException('', 'TimeoutError')))
    vi.stubGlobal(
      'fetch',
      vi.fn((request: Request) => Promise.reject(request.signal.reason as Error)),
    )
    const error: unknown = await fetchWithTimeout(new Request('http://api.test/health')).catch(
      (e: unknown) => e,
    )
    expect((error as NetworkError).reason).toBe('timeout')
  })

  it('rethrows when the caller cancelled the request', async () => {
    const controller = new AbortController()
    controller.abort()
    const cancelled = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(cancelled)),
    )
    const request = new Request('http://api.test/health', { signal: controller.signal })
    await expect(fetchWithTimeout(request)).rejects.toBe(cancelled)
  })

  it('sets no timeout on uploads', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 202 }))),
    )
    const body = new FormData()
    body.append('file', new Blob(['<kml/>']), 'a.kml')
    await fetchWithTimeout(new Request('http://api.test/api/files/', { method: 'POST', body }))
    expect(timeout).not.toHaveBeenCalled()
  })
})

describe('unwrap', () => {
  it('returns data for a 2xx response', async () => {
    const result = { data: { status: 'ok' }, response: new Response(null, { status: 200 }) }
    await expect(unwrap(Promise.resolve(result))).resolves.toEqual({ status: 'ok' })
  })

  it('throws ApiError with the status and the server detail', async () => {
    const result = {
      error: { detail: 'File id does not exist.' },
      response: new Response(null, { status: 404 }),
    }
    await expect(unwrap(Promise.resolve(result))).rejects.toEqual(
      new ApiError(404, 'File id does not exist.'),
    )
  })

  it('joins FastAPI validation messages and falls back to the status text', async () => {
    const validation = {
      error: { detail: [{ msg: 'limit too large' }, { msg: 'offset negative' }] },
      response: new Response(null, { status: 422 }),
    }
    await expect(unwrap(Promise.resolve(validation))).rejects.toMatchObject({
      status: 422,
      detail: 'limit too large; offset negative',
    })
    const bare = {
      error: undefined,
      response: new Response(null, { status: 503, statusText: 'Service Unavailable' }),
    }
    await expect(unwrap(Promise.resolve(bare))).rejects.toMatchObject({
      status: 503,
      detail: 'Service Unavailable',
    })
  })
})
