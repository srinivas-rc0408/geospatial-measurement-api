import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, NetworkError } from './errors'
import { uploadFile } from './upload'

/** A minimal XMLHttpRequest double: the test drives its events. */
class FakeXhr {
  static last: FakeXhr
  upload = new EventTarget()
  events = new EventTarget()
  status = 0
  statusText = ''
  responseText = ''
  method = ''
  url = ''
  body: unknown
  constructor() {
    FakeXhr.last = this
  }
  addEventListener(type: string, listener: () => void) {
    this.events.addEventListener(type, listener)
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader = vi.fn()
  send(body: unknown) {
    this.body = body
  }
  abort() {
    this.events.dispatchEvent(new Event('abort'))
  }
  respond(status: number, body: string, statusText = '') {
    this.status = status
    this.statusText = statusText
    this.responseText = body
    this.events.dispatchEvent(new Event('load'))
  }
}

function progress(loaded: number, total: number) {
  return Object.assign(new Event('progress'), { lengthComputable: true, loaded, total })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadFile', () => {
  it('posts the file as multipart form data, reports progress and resolves with the file info', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const onProgress = vi.fn()
    const promise = uploadFile(new File(['<kml/>'], 'site.kml'), onProgress)
    const xhr = FakeXhr.last
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('http://api.test/api/files/')
    expect((xhr.body as FormData).get('file')).toBeInstanceOf(File)

    xhr.upload.dispatchEvent(progress(50, 100))
    xhr.upload.dispatchEvent(new Event('load'))
    expect(onProgress.mock.calls).toEqual([[0.5], [1]])

    xhr.respond(202, JSON.stringify({ id: 'abc', status: 'PENDING' }))
    await expect(promise).resolves.toEqual({ id: 'abc', status: 'PENDING' })
  })

  it('rejects with ApiError carrying the server detail, or the status text for non-JSON bodies', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const rejected = uploadFile(new File(['x'], 'a.zip'), vi.fn())
    FakeXhr.last.respond(422, JSON.stringify({ detail: 'Missing .dbf.' }))
    await expect(rejected).rejects.toEqual(new ApiError(422, 'Missing .dbf.'))

    const proxied = uploadFile(new File(['x'], 'a.zip'), vi.fn())
    FakeXhr.last.respond(502, '<html>Bad gateway</html>', 'Bad Gateway')
    await expect(proxied).rejects.toEqual(new ApiError(502, 'Bad Gateway'))
  })

  it('rejects with NetworkError when the connection fails, and AbortError when cancelled', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const offline = uploadFile(new File(['x'], 'a.zip'), vi.fn())
    FakeXhr.last.events.dispatchEvent(new Event('error'))
    await expect(offline).rejects.toBeInstanceOf(NetworkError)

    const controller = new AbortController()
    const cancelled = uploadFile(new File(['x'], 'a.zip'), vi.fn(), controller.signal)
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  })
})
