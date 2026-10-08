import { Link } from 'react-router'

import { Logo } from '@/components/Logo'

import { ExternalLink } from './ExternalLink'
import { API_DOCS_URL, GITHUB_URL, PORTFOLIO_URL } from './links'

const VERSION = __APP_VERSION__

const link =
  'inline-flex min-h-11 items-center text-text-secondary transition-colors duration-150 hover:text-text'

/** Full-width footer with link columns, credits and attribution. */
export function Footer() {
  return (
    <footer className="border-t border-separator bg-bg">
      <div className="mx-auto max-w-workspace px-5.5 py-12 sm:px-10 sm:py-16">
        {/* Top: logo + columns */}
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
          {/* Brand */}
          <div className="flex shrink-0 flex-col gap-2">
            <Logo />
            <p className="text-callout text-text-secondary">Measure every site. Precisely.</p>
          </div>

          {/* Link columns */}
          <div className="grid flex-1 grid-cols-2 gap-8 text-callout sm:grid-cols-3 sm:gap-12">
            <div className="flex flex-col gap-1">
              <h3 className="text-caption font-semibold tracking-wider text-text-tertiary uppercase">
                Product
              </h3>
              <nav aria-label="Product links" className="flex flex-col">
                <Link to="/#upload" className={link}>
                  Upload
                </Link>
                <Link to="/#samples" className={link}>
                  Samples
                </Link>
                <Link to="/files" className={link}>
                  History
                </Link>
              </nav>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-caption font-semibold tracking-wider text-text-tertiary uppercase">
                Developers
              </h3>
              <nav aria-label="Developer links" className="flex flex-col">
                <ExternalLink href={API_DOCS_URL} className={link}>
                  API Docs
                </ExternalLink>
                <ExternalLink href="/openapi.json" className={link}>
                  OpenAPI JSON
                </ExternalLink>
                <ExternalLink href={GITHUB_URL} className={link}>
                  GitHub
                </ExternalLink>
              </nav>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-caption font-semibold tracking-wider text-text-tertiary uppercase">
                Author
              </h3>
              <nav aria-label="Author links" className="flex flex-col">
                <ExternalLink href={PORTFOLIO_URL} className={link}>
                  Portfolio
                </ExternalLink>
                <ExternalLink href="https://github.com/srinivas-rc0408" className={link}>
                  GitHub
                </ExternalLink>
              </nav>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-8 border-t border-separator sm:my-10" />

        {/* Credits */}
        <div className="flex flex-col gap-3 text-caption text-text-tertiary">
          <p className="text-callout text-text-secondary">
            Designed &amp; built by <strong className="font-semibold text-text">Srinivas R C</strong>
            {' · '}SRN R23EA121{' · '}REVA University, Bengaluru
          </p>
          <p>Submitted for the Aereo SDE Intern assignment</p>
          <p>© 2026 Srinivas R C · Map data © OpenStreetMap contributors · Tiles: OpenFreeMap</p>
          {VERSION && <p className="font-mono text-text-tertiary">v{VERSION}</p>}
        </div>
      </div>
    </footer>
  )
}
