import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, MotionConfig } from 'motion/react'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { ToastProvider } from '@/components/ui/Toast'
import { createQueryClient } from '@/lib/api/queryClient'

import { routes } from './routes'

const router = createBrowserRouter(routes)
const loadMotionFeatures = () => import('@/lib/motionFeatures').then((module) => module.default)

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user": transforms and layout animations are skipped for reduced-motion users. */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadMotionFeatures} strict>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  )
}
