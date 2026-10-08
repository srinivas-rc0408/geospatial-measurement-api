import { ChevronRight, LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

import { Icon } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const base =
  'relative inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-full text-body font-normal whitespace-nowrap transition duration-150 ease-standard select-none active:scale-98 disabled:pointer-events-none disabled:opacity-40 aria-busy:cursor-progress'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-fill px-5 text-on-accent hover:bg-accent-fill-hover',
  secondary: 'bg-fill px-5 text-text hover:bg-fill-hover',
  ghost: 'px-2 text-link hover:underline',
}

function classes(variant: ButtonVariant, className?: string) {
  return [base, variants[variant], className].filter(Boolean).join(' ')
}

function Content({
  children,
  chevron,
  loading,
}: {
  children: ReactNode
  chevron: boolean
  loading: boolean
}) {
  return (
    <>
      {/* The label stays in the layout while loading, so the button keeps its width. */}
      <span
        className={loading ? 'invisible inline-flex items-center gap-1' : 'inline-flex items-center gap-1'}
      >
        {children}
        {chevron && <Icon icon={ChevronRight} size={17} />}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon icon={LoaderCircle} className="animate-spin" />
        </span>
      )}
    </>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /**
   * Shows a spinner and ignores clicks. The button stays focusable (no `disabled`), so keyboard focus is not
   * lost mid-action; the label is kept for width and for screen readers.
   */
  loading?: boolean
  /** Trailing chevron (›), for ghost "go somewhere" actions. */
  chevron?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  chevron = false,
  className,
  type = 'button',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      <Content chevron={chevron} loading={loading}>
        {children}
      </Content>
    </button>
  )
}

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant; chevron?: boolean }

/** A navigation link that looks like a Button. */
export function ButtonLink({
  variant = 'primary',
  chevron = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes(variant, typeof className === 'string' ? className : undefined)} {...rest}>
      <Content chevron={chevron} loading={false}>
        {children}
      </Content>
    </Link>
  )
}
