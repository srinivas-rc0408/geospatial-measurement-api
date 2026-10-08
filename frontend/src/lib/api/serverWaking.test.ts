import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SLOW_REQUEST_MS, trackServerWait, useServerWaking } from './serverWaking'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('server waking', () => {
  it('turns on only after a request has waited 2.5 s, and off when every slow request settles', () => {
    const { result } = renderHook(() => useServerWaking())
    const first = trackServerWait()
    const second = trackServerWait()
    act(() => {
      vi.advanceTimersByTime(SLOW_REQUEST_MS - 1)
    })
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)
    act(() => {
      first()
      first() // settling twice is harmless
    })
    expect(result.current).toBe(true)
    act(() => {
      second()
    })
    expect(result.current).toBe(false)
  })

  it('ignores fast requests', () => {
    const { result } = renderHook(() => useServerWaking())
    act(() => {
      trackServerWait()()
      vi.advanceTimersByTime(SLOW_REQUEST_MS * 2)
    })
    expect(result.current).toBe(false)
  })
})
