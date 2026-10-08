import { ButtonLink } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-marketing flex-col items-center gap-6 px-5.5 py-24 text-center sm:py-32">
      <title>Page not found · Geo Measure</title>
      <p className="text-callout font-semibold text-text-secondary">404</p>
      <h1 className="text-title-1">Page not found</h1>
      <p className="max-w-prose text-text-secondary">The page you asked for does not exist or has moved.</p>
      <ButtonLink to="/">Back to home</ButtonLink>
    </section>
  )
}
