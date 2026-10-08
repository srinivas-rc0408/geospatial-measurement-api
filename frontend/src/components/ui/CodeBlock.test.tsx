import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CodeBlock } from './CodeBlock'

const code = 'curl -F "file=@site.kml" http://localhost:8000/api/files/'

describe('CodeBlock', () => {
  it('shows the code in a labelled figure', () => {
    render(<CodeBlock code={code} label="curl upload command" />)
    expect(screen.getByRole('figure', { name: 'curl upload command' })).toHaveTextContent(code)
  })

  it('copies the code and announces "Copied"', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<CodeBlock code={code} label="curl upload command" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(code)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('says so when the clipboard is unavailable', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    render(<CodeBlock code={code} label="curl upload command" />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument()
  })
})
