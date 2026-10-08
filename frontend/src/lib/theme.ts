/** Theme preference: dark by default (the brand look), or light / follow-the-system, kept in localStorage. */
import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Also read by the inline script in index.html, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'geo-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
export const DEFAULT_PREFERENCE: ThemePreference = 'dark'

function isPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : DEFAULT_PREFERENCE
  } catch {
    return DEFAULT_PREFERENCE // storage blocked (private mode, disabled cookies)
  }
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function saveThemePreference(preference: ThemePreference): void {
  try {
    if (preference === DEFAULT_PREFERENCE) localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Not persisted; the choice still applies for this page view.
  }
}

/** The current preference and a setter; keeps data-theme on <html> in sync, including OS changes. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState(readThemePreference)

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset['theme'] = resolveTheme(preference)
    }
    apply()
    saveThemePreference(preference)
    if (preference !== 'system') return
    const media = window.matchMedia(DARK_QUERY)
    media.addEventListener('change', apply)
    return () => {
      media.removeEventListener('change', apply)
    }
  }, [preference])

  return [preference, setPreference]
}
