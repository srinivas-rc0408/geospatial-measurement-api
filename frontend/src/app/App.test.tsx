import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/ui/Toast'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { createQueryClient } from '@/lib/api/queryClient'

import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { routes } from './routes'

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TooltipProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return router
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('app shell', () => {
  it('renders the home hero with its title', () => {
    renderAt('/')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Measure every site. Precisely.' }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Geo Measure · Measure every site. Precisely.')
  })

  it('has landmarks and a skip link to the main content', () => {
    renderAt('/')
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })

  it('opens API Docs and GitHub in a new tab, safely', () => {
    renderAt('/')
    // jsdom's name computation drops the space before the sr-only text; browsers keep it.
    const docs = screen.getByRole('link', { name: /^API Docs\s*\(opens in a new tab\)$/ })
    expect(docs).toHaveAttribute('href', 'http://api.test/docs')
    for (const link of [
      docs,
      ...screen.getAllByRole('link', { name: /^GitHub\s*\(opens in a new tab\)$/ }),
    ]) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('navigates to Files and marks the link current', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'Files' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Files' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Files · Geo Measure')
  })

  it('shows the file id on the results route', () => {
    renderAt('/files/9f69fdac523d4233a88b21b0ca504506')
    expect(screen.getByText('File 9f69fdac523d4233a88b21b0ca504506')).toBeInTheDocument()
  })

  it('cycles the theme System → Light → Dark → System', async () => {
    renderAt('/')
    const toggle = () => screen.getByRole('button', { name: /^Theme:/ })
    expect(toggle()).toHaveAccessibleName('Theme: System. Switch to Light')
    await userEvent.click(toggle())
    expect(document.documentElement.dataset['theme']).toBe('light')
    await userEvent.click(toggle())
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(toggle()).toHaveAccessibleName('Theme: Dark. Switch to System')
    await userEvent.click(toggle())
    expect(localStorage.getItem('geo-theme')).toBeNull()
  })

  it('shows a 404 page for unknown routes, with a way home', () => {
    renderAt('/nowhere')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(document.title).toBe('Page not found · Geo Measure')
  })

  it('catches a page error and keeps the navigation', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Broken(): never {
      throw new Error('boom')
    }
    renderAt('/broken', [
      {
        Component: RootLayout,
        children: [{ ErrorBoundary: RouteError, children: [{ path: 'broken', Component: Broken }] }],
      },
    ])
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
  })

  it('serves the component gallery in development', async () => {
    renderAt('/dev/ui')
    expect(await screen.findByRole('heading', { level: 1, name: 'UI gallery' })).toBeInTheDocument()
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
  })
})
