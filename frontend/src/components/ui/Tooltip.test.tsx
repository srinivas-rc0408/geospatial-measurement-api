import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Tooltip, TooltipProvider } from './Tooltip'

describe('Tooltip', () => {
  it('opens on keyboard focus, describes its trigger, and closes on Esc', async () => {
    render(
      <TooltipProvider>
        <Tooltip content="The area on the Earth's curved surface, without any map projection.">
          <button type="button">Geodesic</button>
        </Tooltip>
      </TooltipProvider>,
    )
    await userEvent.tab()
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/curved surface/)
    expect(screen.getByRole('button', { name: 'Geodesic' })).toHaveAccessibleDescription(/curved surface/)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
