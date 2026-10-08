import type { RouteObject } from 'react-router'

import Files from '@/pages/Files'
import Home from '@/pages/Home'
import NotFound from '@/pages/NotFound'
import Results from '@/pages/Results'

import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

/** The component gallery exists only in development; the condition removes it from production builds. */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/ui',
        HydrateFallback: () => null, // nothing to show while the lazy chunk loads on a direct visit
        lazy: async () => ({ Component: (await import('@/pages/DevGallery')).default }),
      },
    ]
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
          { path: 'files', Component: Files },
          { path: 'files/:id', Component: Results },
          ...devRoutes,
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
]
