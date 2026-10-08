/** Typed failures of an API call. Components show `message`; logic branches on the class and `status`. */

/** The server answered with a 4xx/5xx; `detail` is its human-readable reason. */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

/** No usable answer: offline, DNS/CORS failure, or the request took longer than the timeout. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'
  readonly reason: 'offline' | 'timeout'

  constructor(reason: 'offline' | 'timeout') {
    super(
      reason === 'timeout'
        ? 'The server took too long to respond. Try again in a moment.'
        : 'Could not reach the server. Check your connection and try again.',
    )
    this.reason = reason
  }
}

/** FastAPI errors are {"detail": "..."}; validation errors are {"detail": [{"msg": "..."}, ...]}. */
export function detailFrom(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return fallback
  const { detail } = body
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: unknown) =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string'
          ? item.msg
          : null,
      )
      .filter((message) => message !== null)
    if (messages.length) return messages.join('; ')
  }
  return fallback
}
