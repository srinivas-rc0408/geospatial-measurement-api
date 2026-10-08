import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('shows the readable label', () => {
    render(<StatusPill status="NOT_APPLICABLE" />)
    expect(screen.getByText('Not applicable')).toBeInTheDocument()
  })

  it('is a live status region only when asked', () => {
    const { rerender } = render(<StatusPill status="PROCESSING" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    rerender(<StatusPill status="COMPLETED" live />)
    expect(screen.getByRole('status')).toHaveTextContent('Completed')
  })

  it.each([
    ['MEASURED', 'text-success'],
    ['FAILED', 'text-danger'],
    ['UNSUPPORTED', 'text-neutral'],
  ] as const)('colours %s with %s', (status, className) => {
    render(<StatusPill status={status} />)
    expect(screen.getByText(/./, { selector: 'span.rounded-full' })).toHaveClass(className)
  })
})
