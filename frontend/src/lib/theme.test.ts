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
  it('defaults to system and ignores unknown stored values', () => {
    expect(readThemePreference()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(readThemePreference()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('falls back to system when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(readThemePreference()).toBe('system')
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
  it('applies data-theme and stores overrides; system clears the stored value', () => {
    systemPrefersDark(true)
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
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })
})
