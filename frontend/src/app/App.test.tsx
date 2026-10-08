import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/ui/Toast'
import { createQueryClient } from '@/lib/api/queryClient'

import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { routes } from './routes'

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
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

  it('lays out the home page: upload, samples, explanation sections and the real curl command', () => {
    renderAt('/')
    for (const name of [
      'Measure a file',
      'How it works',
      'Why projection matters',
      'Built for accuracy',
      'For developers',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: /^Measure the .* sample$/ })).toHaveLength(3)
    expect(screen.getByText('1,000,000 m²')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Learn how/ })).toHaveAttribute(
      'href',
      'https://github.com/srinivas-rc0408/geospatial-measurement-api/blob/main/backend/README.md#why-not-measure-in-the-source-crs',
    )
    expect(
      screen.getByText(/curl -F "file=@mine_site_survey.kml" http:\/\/api.test\/api\/files\//),
    ).toBeInTheDocument()
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
    const external = screen.getAllByRole('link', { name: /\(opens in a new tab\)$/ })
    expect(external.length).toBeGreaterThanOrEqual(5) // nav: API Docs, GitHub; footer: GitHub, Portfolio, API Docs
    for (const link of external) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('navigates to Files and marks the link current', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'Files' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Files' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Files · Geo Measure')
  })

  it('routes /files/:id to the results page, which shows a loading layout first', async () => {
    renderAt('/files/9f69fdac523d4233a88b21b0ca504506')
    expect(await screen.findByLabelText('Loading results')).toHaveAttribute('aria-busy', 'true')
    expect(document.title).toBe('Results · Geo Measure')
  })

  it('cycles the theme Dark → Light → System → Dark', async () => {
    renderAt('/')
    const toggle = () => screen.getByRole('button', { name: /^Theme:/ })
    expect(toggle()).toHaveAccessibleName('Theme: Dark. Switch to Light')
    await userEvent.click(toggle())
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(toggle()).toHaveAccessibleName('Theme: Light. Switch to System')
    await userEvent.click(toggle())
    expect(localStorage.getItem('geo-theme')).toBe('system')
    await userEvent.click(toggle())
    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(localStorage.getItem('geo-theme')).toBeNull()
  })

  it('links the logo home and lists GitHub, Portfolio and API Docs in the footer', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Geo Measure' })).toHaveAttribute('href', '/')
    const footer = screen.getByRole('contentinfo')
    for (const [name, href] of [
      ['GitHub', 'https://github.com/srinivas-rc0408/geospatial-measurement-api'],
      ['GitHub', 'https://github.com/srinivas-rc0408'],
      ['Portfolio', 'https://srinivas-rc.is-a.dev'],
      ['API Docs', 'http://api.test/docs'],
    ] as const) {
      const hrefs = within(footer)
        .getAllByRole('link', { name: new RegExp(`^${name}`) })
        .map((a) => a.getAttribute('href'))
      expect(hrefs).toContain(href)
    }
    expect(footer).toHaveTextContent('Srinivas R C · SRN R23EA121 · REVA University, Bengaluru')
  })

  it('shows a 404 page for unknown routes, with a way home', async () => {
    renderAt('/nowhere')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
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
