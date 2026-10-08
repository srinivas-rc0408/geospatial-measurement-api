/** Server state. Components use these hooks and never call the API client directly. */
import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'

/** Is the backend up and its database reachable? A 503 surfaces as an ApiError. */
export function useHealthReady() {
  return useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => unwrap(api.GET('/health/ready', { signal })),
  })
}
