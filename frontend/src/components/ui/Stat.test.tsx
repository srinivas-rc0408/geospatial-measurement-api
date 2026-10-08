import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Card } from './Card'
import { Skeleton } from './Skeleton'
import { Stat } from './Stat'

describe('Stat', () => {
  it('shows the label, the value and the unit', () => {
    render(<Stat label="Total area" value="23.20" unit="ha" />)
    expect(screen.getByText('Total area')).toBeInTheDocument()
    expect(screen.getByText('23.20')).toHaveTextContent('23.20ha')
    expect(screen.getByText('ha')).toHaveClass('text-text-secondary')
  })

  it('omits the unit when there is none', () => {
    render(<Stat label="Measured" value="5 of 7" />)
    expect(screen.getByText('5 of 7').children).toHaveLength(0)
  })
})

describe('Card', () => {
  it('passes through content and attributes', () => {
    render(
      <Card aria-label="Upload" className="extra">
        content
      </Card>,
    )
    const card = screen.getByLabelText('Upload')
    expect(card).toHaveTextContent('content')
    expect(card).toHaveClass('rounded-lg', 'extra')
  })
})

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton className="h-6 w-40" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstChild).toHaveClass('h-6', 'w-40', 'bg-fill')
  })
})
