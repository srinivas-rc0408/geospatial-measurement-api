import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Sheet } from './Sheet'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Open details
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Pit boundary" description="Polygon · Site boundaries">
        <button type="button">Copy GeoJSON</button>
      </Sheet>
    </>
  )
}

describe('Sheet', () => {
  it('opens as a labelled, described modal dialog with focus inside', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open details' }))
    const dialog = screen.getByRole('dialog', { name: 'Pit boundary' })
    expect(dialog).toHaveAccessibleDescription('Polygon · Site boundaries')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('traps Tab inside the sheet', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open details' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 4; i++) {
      await userEvent.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it('closes on Esc and on the Close button, returning focus to the opener', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open details' })
    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(opener).toHaveFocus()
    })

    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
