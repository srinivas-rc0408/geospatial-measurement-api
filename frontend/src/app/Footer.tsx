import { LogoMark } from '@/components/Logo'

import { ExternalLink } from './ExternalLink'
import { API_DOCS_URL, GITHUB_URL, PORTFOLIO_URL } from './links'

const link = 'inline-flex min-h-11 items-center text-link hover:underline'

export function Footer() {
  return (
    <footer className="border-t border-separator bg-bg-secondary">
      <div className="mx-auto flex max-w-workspace flex-col gap-3 px-5.5 py-8 text-caption text-text-secondary sm:px-10">
        <p className="flex items-center gap-2">
          <LogoMark className="size-5" />
          Built by Srinivas R C for the Aereo SDE Intern assignment
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5">
          <ExternalLink href={GITHUB_URL} className={link}>
            GitHub
          </ExternalLink>
          <ExternalLink href={PORTFOLIO_URL} className={link}>
            Portfolio
          </ExternalLink>
          <ExternalLink href={API_DOCS_URL} className={link}>
            API Docs
          </ExternalLink>
        </nav>
        <p>Map data © OpenStreetMap contributors · Tiles: OpenFreeMap</p>
      </div>
    </footer>
  )
}
