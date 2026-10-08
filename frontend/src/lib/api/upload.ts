/**
 * File upload. Uses XMLHttpRequest rather than fetch because only XHR reports upload progress,
 * which the UI shows as a real percentage. No timeout: large files on slow links take time.
 */
import { API_BASE_URL } from './client'
import { ApiError, detailFrom, NetworkError } from './errors'
import { trackServerWait } from './serverWaking'
import type { FileInfo } from './types'

/** Resolves with the new file (status PENDING); rejects with ApiError, NetworkError or an AbortError. */
export function uploadFile(
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<FileInfo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    // The cold-start clock starts once the body is sent: a slow link is not a sleeping server.
    let serverSettled: (() => void) | undefined
    const settle = () => serverSettled?.()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })
    xhr.upload.addEventListener('load', () => {
      onProgress(1)
      serverSettled = trackServerWait()
    })
    xhr.addEventListener('load', () => {
      settle()
      const body: unknown = xhr.responseText ? safeJson(xhr.responseText) : undefined
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as FileInfo)
      else reject(new ApiError(xhr.status, detailFrom(body, xhr.statusText || `HTTP ${xhr.status}`)))
    })
    xhr.addEventListener('error', () => {
      settle()
      reject(new NetworkError('offline'))
    })
    xhr.addEventListener('abort', () => {
      settle()
      reject(new DOMException('Upload cancelled', 'AbortError'))
    })
    signal?.addEventListener('abort', () => {
      xhr.abort()
    })

    const body = new FormData()
    body.append('file', file)
    xhr.open('POST', `${API_BASE_URL}/api/files/`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.send(body)
  })
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined // e.g. an HTML error page from a proxy; the status text is used instead
  }
}
