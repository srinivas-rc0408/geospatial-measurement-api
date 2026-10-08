import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Button, ButtonLink } from './Button'

describe('Button', () => {
  it('is a type="button" by default and handles clicks and Enter/Space', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Upload a file</Button>)
    const button = screen.getByRole('button', { name: 'Upload a file' })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter} ')
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('keeps its name and focus while loading, and ignores clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Upload
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Upload' })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
    expect(button).toHaveFocus()
  })

  it('is disabled when asked', () => {
    render(<Button disabled>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('renders a decorative chevron for ghost actions', () => {
    render(
      <Button variant="ghost" chevron>
        Try a sample
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Try a sample' })
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('ButtonLink', () => {
  it('is a link to the route', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/">Back to home</ButtonLink>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })
})
