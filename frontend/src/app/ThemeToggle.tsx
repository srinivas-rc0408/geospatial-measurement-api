import { Monitor, Moon, Sun } from 'lucide-react'

import { Icon } from '@/components/ui/Icon'
import { useThemePreference, type ThemePreference } from '@/lib/theme'

const NEXT: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' }
const ICON = { system: Monitor, light: Sun, dark: Moon }

/** Cycles System → Light → Dark. The label states the current theme and what a press does. */
export function ThemeToggle() {
  const [preference, setPreference] = useThemePreference()
  const next = NEXT[preference]
  return (
    <button
      type="button"
      onClick={() => {
        setPreference(next)
      }}
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[preference]}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-fill-hover hover:text-text"
    >
      <Icon icon={ICON[preference]} size={18} />
    </button>
  )
}
