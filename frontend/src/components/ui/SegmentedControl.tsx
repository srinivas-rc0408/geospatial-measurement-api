import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

export type Segment<T extends string> = { value: T; label: string }

type SegmentedControlProps<T extends string> = {
  /** Accessible name of the group, e.g. "Filter measurements". */
  label: string
  options: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * Apple-style segmented control with radio-group semantics: one tab stop, arrow keys move the
 * selection (wrapping), Home/End jump to the ends. Segments are sized by their labels (spare width is
 * shared equally), and the thumb is measured from the selected segment so it fits any label length.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [thumb, setThumb] = useState({ left: 0, width: 0 })
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  useLayoutEffect(() => {
    const button = buttons.current[selected]
    if (!button) return
    const measure = () => {
      setThumb({ left: button.offsetLeft, width: button.offsetWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(button)
    return () => {
      observer.disconnect()
    }
  }, [selected])

  function select(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    buttons.current[index]?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = options.length - 1
    let index: number | null = null
    if (NEXT_KEYS.has(event.key)) index = selected === last ? 0 : selected + 1
    else if (PREVIOUS_KEYS.has(event.key)) index = selected === 0 ? last : selected - 1
    else if (event.key === 'Home') index = 0
    else if (event.key === 'End') index = last
    if (index === null) return
    event.preventDefault()
    select(index)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid h-11 rounded-sm bg-fill p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, auto)` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0 rounded-xs bg-segment-thumb shadow-card transition-[translate,width] duration-250 ease-standard"
        style={{ width: thumb.width, translate: `${thumb.left}px 0` }}
      />
      {options.map((option, index) => {
        const checked = index === selected
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              select(index)
            }}
            className={`relative z-10 rounded-xs px-2 text-caption whitespace-nowrap text-text sm:text-callout ${checked ? 'font-semibold' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
