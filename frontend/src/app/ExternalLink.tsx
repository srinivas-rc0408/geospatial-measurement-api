import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { Icon } from '@/components/ui/Icon'

type ExternalLinkProps = { href: string; children: ReactNode; className?: string }

/** Opens in a new tab without giving the new page access to this one; says so to screen readers. */
export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <Icon icon={ArrowUpRight} size={14} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
