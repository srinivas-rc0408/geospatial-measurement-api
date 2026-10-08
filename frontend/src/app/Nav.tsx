import { Link, NavLink } from 'react-router'

import { ExternalLink } from './ExternalLink'
import { API_DOCS_URL, GITHUB_URL } from './links'
import { ThemeToggle } from './ThemeToggle'

const item =
  'inline-flex h-11 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-sm px-2 text-caption text-text-secondary transition-colors duration-150 hover:text-text sm:text-callout'

/** Glass navigation bar: 52 px including the hairline, sticky, translucent with saturate(180%) blur(20px), hairline bottom. */
export function Nav() {
  return (
    <header className="sticky top-0 z-30 h-nav border-b border-separator bg-nav-glass backdrop-blur-glass backdrop-saturate-180">
      <nav
        aria-label="Main"
        className="mx-auto flex h-full max-w-workspace items-center justify-between gap-2 px-5.5 sm:px-10"
      >
        <Link to="/" className="inline-flex h-11 items-center rounded-sm text-wordmark whitespace-nowrap">
          Geo Measure
        </Link>
        <div className="flex items-center">
          <NavLink to="/files" className={({ isActive }) => `${item} ${isActive ? 'text-text' : ''}`}>
            Files
          </NavLink>
          <ExternalLink href={API_DOCS_URL} className={item}>
            API Docs
          </ExternalLink>
          {/* Hidden on phones to keep 44 px targets in 390 px; the footer links GitHub on every page. */}
          <ExternalLink href={GITHUB_URL} className={`${item} max-sm:hidden`}>
            GitHub
          </ExternalLink>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
