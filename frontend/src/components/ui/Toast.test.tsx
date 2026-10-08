import { act, render, screen } from '@testing-library/react'
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

  it('fails loudly outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<ShowButton />)).toThrow(/inside <ToastProvider>/)
  })
})
