import { act, render, screen } from '@testing-library/react'
import { MotionConfig } from 'motion/react'
import { describe, expect, it } from 'vitest'

import { formatArea } from '@/lib/format'
import { intersectAll } from '@/test/setup'

import { CountUp, COUNT_UP_SECONDS } from './CountUp'

describe('CountUp', () => {
  it('gives screen readers only the final value, and counts up from 0 once in view', async () => {
    render(<CountUp value={944_917} format={formatArea} />)
    // Final text for assistive technology; the animated copy is aria-hidden.
    expect(screen.getByText('944,917 m²', { selector: '.sr-only' })).toBeInTheDocument()
    const visible = () =>
      screen.getAllByText(/m²$/).find((element) => !element.matches('.sr-only, .invisible'))
    expect(visible()).toHaveTextContent('0 m²')

    act(() => {
      intersectAll()
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, COUNT_UP_SECONDS * 1000 + 200)))
    expect(visible()).toHaveTextContent('944,917 m²')
  })

  it('shows the final value immediately for reduced-motion users', () => {
    render(
      <MotionConfig reducedMotion="always">
        <CountUp value={1234} format={formatArea} />
      </MotionConfig>,
    )
    const shown = screen.getAllByText('1,234 m²')
    expect(shown.length).toBe(3) // width holder, visible copy, screen-reader copy
  })
})
