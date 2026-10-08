/** Server state. Components use these hooks and never call the API client directly. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from './client'
import type { FileInfo } from './types'
import { uploadFile } from './upload'

export const POLL_INTERVAL_MS = 1000

/** Still being worked on by the server, so worth polling. */
export function isInProgress(file: Pick<FileInfo, 'status'> | undefined): boolean {
  return file?.status === 'PENDING' || file?.status === 'PROCESSING'
}

/** Is the backend up and its database reachable? A 503 surfaces as an ApiError. */
export function useHealthReady() {
  return useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => unwrap(api.GET('/health/ready', { signal })),
  })
}

export const fileKey = (id: string) => ['files', id] as const

/** One file's info; polls every second while it is PENDING or PROCESSING, then stops. */
export function useFile(id: string | undefined) {
  return useQuery({
    queryKey: fileKey(id ?? ''),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/files/{file_id}', { params: { path: { file_id: id ?? '' } }, signal })),
    enabled: id !== undefined,
    refetchInterval: (query) => (isInProgress(query.state.data) ? POLL_INTERVAL_MS : false),
  })
}

type UploadVariables = { file: File; onProgress: (fraction: number) => void }

/** Uploads a file (with progress) and seeds the file's cache entry with the server's answer. */
export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onProgress }: UploadVariables) => uploadFile(file, onProgress),
    onSuccess: (file) => {
      queryClient.setQueryData(fileKey(file.id), file)
    },
  })
}
