import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readThemePreference, resolveTheme, THEME_STORAGE_KEY, useThemePreference } from './theme'

function systemPrefersDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: dark,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  delete document.documentElement.dataset['theme']
})

describe('theme preference', () => {
  it('defaults to dark and ignores unknown stored values', () => {
    expect(readThemePreference()).toBe('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readThemePreference()).toBe('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    expect(readThemePreference()).toBe('system')
  })

  it('falls back to dark when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readThemePreference()).toBe('dark')
  })

  it('resolves system from the OS setting, overrides directly', () => {
    systemPrefersDark(true)
    expect(resolveTheme('system')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
    systemPrefersDark(false)
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('useThemePreference', () => {
  it('is dark by default, even on a light OS; stores overrides; dark clears the stored value', () => {
    systemPrefersDark(false)
    const { result } = renderHook(() => useThemePreference())
    expect(document.documentElement.dataset['theme']).toBe('dark')

    act(() => {
      result.current[1]('light')
    })
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    act(() => {
      result.current[1]('system')
    })
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')

    act(() => {
      result.current[1]('dark')
    })
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})
