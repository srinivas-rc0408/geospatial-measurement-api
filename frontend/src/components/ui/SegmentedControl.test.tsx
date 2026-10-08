import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'all', label: 'All' },
  { value: 'measured', label: 'Measured' },
  { value: 'attention', label: 'Needs attention' },
] as const

function Harness() {
  const [value, setValue] = useState<(typeof options)[number]['value']>('all')
  return <SegmentedControl label="Filter measurements" options={options} value={value} onChange={setValue} />
}

describe('SegmentedControl', () => {
  it('is a labelled radio group with one checked radio and one tab stop', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Filter measurements' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1])
  })

  it('selects on click', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('radio', { name: 'Measured' }))
    expect(screen.getByRole('radio', { name: 'Measured' })).toBeChecked()
  })

  it('moves selection and focus with arrow keys, wrapping, and Home/End', async () => {
    render(<Harness />)
    await userEvent.tab()
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Measured' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Measured' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked() // wrapped

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Needs attention' })).toBeChecked() // wrapped back

    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Needs attention' })).toBeChecked()
  })
})
