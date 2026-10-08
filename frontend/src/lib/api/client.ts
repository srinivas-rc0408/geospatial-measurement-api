/** The typed API client. Paths, parameters and response types all come from the generated schema. */
import createClient from 'openapi-fetch'

import { ApiError, detailFrom, NetworkError } from './errors'
import type { paths } from './schema'
import { trackServerWait } from './serverWaking'

/** JSON requests give up after this long. Uploads have no timeout: large files on slow links take time. */
export const JSON_TIMEOUT_MS = 15_000

/**
 * The API's origin. Empty or unset means the same origin as the page: the backend serves the app in
 * production, and `npm run dev` proxies /api to it. A value is only needed for an API hosted elsewhere.
 */
export function readApiBaseUrl(value: unknown): string {
  const hint =
    'Leave VITE_API_BASE_URL empty for the same origin, or set a full URL (see frontend/.env.example)'
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) return ''
  if (typeof value !== 'string') throw new Error(`VITE_API_BASE_URL must be a string. ${hint}`)
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error(`VITE_API_BASE_URL is not a valid URL: "${value}". ${hint}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`VITE_API_BASE_URL must start with http:// or https://, got "${value}". ${hint}`)
  }
  return url.href.replace(/\/+$/, '')
}

function isUpload(request: Request): boolean {
  return request.headers.get('content-type')?.startsWith('multipart/form-data') ?? false
}

/** fetch with a timeout for JSON requests, turning transport failures into NetworkError. */
export async function fetchWithTimeout(request: Request): Promise<Response> {
  const timeout = isUpload(request) ? null : AbortSignal.timeout(JSON_TIMEOUT_MS)
  const signal = timeout ? AbortSignal.any([request.signal, timeout]) : request.signal
  const settled = trackServerWait()
  try {
    return await fetch(timeout ? new Request(request, { signal }) : request)
  } catch (error) {
    if (request.signal.aborted) throw error // cancelled by the caller (e.g. TanStack Query): not a failure
    throw new NetworkError(timeout?.aborted ? 'timeout' : 'offline')
  } finally {
    settled()
  }
}

/** Validated once at startup: a malformed value stops the app with a fix-it message. '' = same origin. */
export const API_BASE_URL = readApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

/** The API's absolute origin, for links people copy (curl command, API link). */
export const API_ORIGIN = API_BASE_URL || window.location.origin

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: fetchWithTimeout,
})

type FetchResult<T> = { data?: T; error?: unknown; response: Response }

/** The response data, or an ApiError carrying the status and the server's `detail`. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) {
    throw new ApiError(response.status, detailFrom(error, response.statusText || `HTTP ${response.status}`))
  }
  return data as T
}
