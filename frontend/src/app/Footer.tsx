import { ExternalLink } from './ExternalLink'
import { GITHUB_URL } from './links'

export function Footer() {
  return (
    <footer className="border-t border-separator bg-bg-secondary">
      <div className="mx-auto flex max-w-workspace flex-col gap-2 px-5.5 py-8 text-caption text-text-secondary sm:px-10">
        <p>
          Built by Srinivas R C for the Aereo SDE Intern assignment ·{' '}
          <ExternalLink href={GITHUB_URL} className="inline-flex items-center text-link hover:underline">
            GitHub
          </ExternalLink>
        </p>
        <p>Map data © OpenStreetMap contributors · Tiles: OpenFreeMap</p>
      </div>
    </footer>
  )
}
