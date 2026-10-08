import { ExternalLink } from '@/app/ExternalLink'
import { API_DOCS_URL, GITHUB_URL } from '@/app/links'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { API_BASE_URL } from '@/lib/api/client'

import { Section } from './Section'

const link = 'inline-flex min-h-11 items-center gap-0.5 text-body text-link hover:underline'

export function ForDevelopers() {
  return (
    <Section
      id="developers"
      title="For developers"
      lead="Everything on this page is a plain JSON API. Upload with one request, then poll the file until it is measured."
    >
      <CodeBlock
        label="curl upload command"
        code={`curl -F "file=@mine_site_survey.kml" ${API_BASE_URL}/api/files/`}
      />
      <div className="flex flex-wrap gap-x-8">
        <ExternalLink href={API_DOCS_URL} className={link}>
          API Docs
        </ExternalLink>
        <ExternalLink href={GITHUB_URL} className={link}>
          GitHub
        </ExternalLink>
      </div>
    </Section>
  )
}
