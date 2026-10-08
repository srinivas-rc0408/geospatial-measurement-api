import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'

import Home from '@/pages/Home'

import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

/**
 * Home is in the first chunk (it is the landing page); other pages load on demand, so their code
 * (Radix Dialog, the results workspace) never delays the first paint.
 */
const page = (load: () => Promise<{ default: ComponentType }>): RouteObject => ({
  HydrateFallback: () => null, // a direct visit renders nothing until the page's chunk has loaded
  lazy: async () => ({ Component: (await load()).default }),
})

/** The component gallery exists only in development; the condition removes it from production builds. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/ui', ...page(() => import('@/pages/DevGallery')) }]
  : []

export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        // Pathless: a page error keeps the nav and footer.
        ErrorBoundary: RouteError,
        children: [
          { index: true, Component: Home },
          { path: 'files', ...page(() => import('@/pages/Files')) },
          { path: 'files/:id', ...page(() => import('@/pages/Results')) },
          ...devRoutes,
          { path: '*', ...page(() => import('@/pages/NotFound')) },
        ],
      },
    ],
  },
]
