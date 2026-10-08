import { useRouteError } from 'react-router'

import { Button, ButtonLink } from '@/components/ui/Button'

/** Shown when a page throws while rendering. Calm, with a way out; details go to the console in dev only. */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <section className="mx-auto flex max-w-marketing flex-col items-center gap-6 px-5.5 py-24 text-center">
      <title>Something went wrong · Geo Measure</title>
      <h1 className="text-title-2">Something went wrong</h1>
      <p className="max-w-prose text-text-secondary">
        This page could not be displayed. Reloading usually fixes it. If it keeps happening, start again from
        the home page.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload the page
        </Button>
        <ButtonLink to="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </section>
  )
}
