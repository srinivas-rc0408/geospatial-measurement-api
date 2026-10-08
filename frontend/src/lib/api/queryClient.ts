import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './errors'

const MAX_RETRIES = 2

/** Client errors (4xx) will not change on retry; network failures and 5xx might. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < MAX_RETRIES
}

/**
 * networkMode 'always': without a connection a request fails at once with the app's "Could not reach the
 * server" message. The default ('online') pauses it silently instead: an upload would sit at 0% and then
 * start on its own whenever the connection came back.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  })
}
