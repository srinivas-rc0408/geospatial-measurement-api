import { Outlet, ScrollRestoration, useLocation } from 'react-router'

import { Footer } from './Footer'
import { Nav } from './Nav'
import { ServerWakeBanner } from './ServerWakeBanner'

export function RootLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only z-50 rounded-full bg-accent-fill px-5 py-3 text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Nav />
      <ServerWakeBanner />
      <main id="content" tabIndex={-1} className="min-h-hero flex-1 focus:outline-none">
        {/* At least one screen tall, so the footer starts below the fold and never jumps as a page loads.
            Keyed by path: each new page fades in (200 ms), so route changes read as one motion. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      {/* New pages start at the top, Back restores the position, and /#upload scrolls to its anchor. */}
      <ScrollRestoration />
      <Footer />
    </div>
  )
}
