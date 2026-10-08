import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TOAST_DURATION_MS, ToastProvider } from './Toast'
import { useToast } from './toastContext'

function ShowButton() {
  const show = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        show('Link copied')
      }}
    >
      Copy link
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('announces the message in a polite live region and dismisses it after 4 s', () => {
    render(
      <ToastProvider>
        <ShowButton />
      </ToastProvider>,
    )
    const region = document.querySelector('[aria-live="polite"]')
    expect(region).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: 'Copy link' }).click()
    })
    expect(region).toHaveTextContent('Link copied')
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS)
    })
    expect(region).toBeEmptyDOMElement()
  })

  it('stacks toasts, keeps at most three, and pauses the timer while hovered', () => {
    render(
      <ToastProvider>
        <ShowButton />
      </ToastProvider>,
    )
    const button = screen.getByRole('button', { name: 'Copy link' })
    act(() => {
      for (let i = 0; i < 4; i++) button.click()
    })
    expect(screen.getAllByText('Link copied')).toHaveLength(3)

    const [first] = screen.getAllByText('Link copied')
    if (!first) throw new Error('no toast')
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS / 2)
    })
    fireEvent.mouseEnter(first)
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS * 2)
    })
    expect(screen.getAllByText('Link copied')).toHaveLength(1) // only the hovered one stays
    fireEvent.mouseLeave(first)
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS / 2)
    })
    expect(screen.queryByText('Link copied')).not.toBeInTheDocument()
  })

  it('fails loudly outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<ShowButton />)).toThrow(/inside <ToastProvider>/)
  })
})
