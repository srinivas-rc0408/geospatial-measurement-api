import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from './errors'
import { createQueryClient, shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('never retries a 4xx', () => {
    expect(shouldRetry(0, new ApiError(404, 'not found'))).toBe(false)
    expect(shouldRetry(0, new ApiError(422, 'bad file'))).toBe(false)
  })

  it('retries network failures and 5xx at most twice', () => {
    for (const error of [
      new NetworkError('offline'),
      new NetworkError('timeout'),
      new ApiError(503, 'down'),
    ]) {
      expect(shouldRetry(0, error)).toBe(true)
      expect(shouldRetry(1, error)).toBe(true)
      expect(shouldRetry(2, error)).toBe(false)
    }
  })

  it('is the default, with window-focus refetching off', () => {
    const queries = createQueryClient().getDefaultOptions().queries
    expect(queries?.retry).toBe(shouldRetry)
    expect(queries?.refetchOnWindowFocus).toBe(false)
  })
})
