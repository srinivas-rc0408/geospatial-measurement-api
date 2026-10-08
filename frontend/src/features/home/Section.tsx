import type { ReactNode } from 'react'

type SectionProps = {
  id: string
  title: string
  /** One sentence under the title. */
  lead?: string
  /** 'alt' sections sit on --bg-alt, so neighbouring sections alternate. */
  tone?: 'default' | 'alt'
  children: ReactNode
}

/** A marketing section: 980 px column, generous vertical rhythm, one heading. */
export function Section({ id, title, lead, tone = 'default', children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-nav ${tone === 'alt' ? 'bg-bg-alt' : ''}`}
    >
      <div aria-hidden="true" className="divider-fade" />
      <div className="mx-auto flex max-w-marketing flex-col gap-10 px-5.5 py-16 sm:px-10 sm:py-24 md:py-32">
        <div className="flex flex-col gap-3">
          <h2 id={`${id}-title`} className="text-title-1 text-balance">
            {title}
          </h2>
          {lead && <p className="max-w-prose text-body text-pretty text-text-secondary">{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  )
}
