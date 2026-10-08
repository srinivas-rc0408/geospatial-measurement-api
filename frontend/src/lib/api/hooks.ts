/** Server state. Components use these hooks and never call the API client directly. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureCollection, Geometry } from 'geojson'

import { api, unwrap } from './client'
import type { FileInfo, MeasurementList } from './types'
import { uploadFile } from './upload'

/** The API's largest page; files with more features are fetched page by page. */
const PAGE_LIMIT = 1000

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

/** Upload limits from the server (GET /api/config): the one source for client-side checks. */
export function useClientConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: ({ signal }) => unwrap(api.GET('/api/config', { signal })),
    staleTime: Infinity, // fixed for the server's lifetime
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

/** Every measurement of a completed file (all pages), plus the whole-file summary. */
export function useMeasurements(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...fileKey(id), 'measurements'],
    enabled,
    staleTime: Infinity, // a completed file's measurements never change
    queryFn: async ({ signal }): Promise<MeasurementList> => {
      const page = (offset: number) =>
        unwrap(
          api.GET('/api/files/{file_id}/measurements/', {
            params: { path: { file_id: id }, query: { limit: PAGE_LIMIT, offset } },
            signal,
          }),
        )
      const first = await page(0)
      const items = [...first.items]
      while (items.length < first.total) {
        const next = await page(items.length)
        if (next.items.length === 0) break // the file shrank mid-read; never loop forever
        items.push(...next.items)
      }
      return { ...first, items, limit: first.total, offset: 0 }
    },
  })
}

/**
 * The file as an RFC 7946 FeatureCollection in EPSG:4326 (geometry + original attributes + measurements).
 * The OpenAPI schema types it as a plain object; GeoJSON's own standard types describe it.
 */
export function useGeoJson(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...fileKey(id), 'geojson'],
    enabled,
    staleTime: Infinity,
    queryFn: async ({ signal }) =>
      (await unwrap(
        api.GET('/api/files/{file_id}/geojson/', { params: { path: { file_id: id } }, signal }),
      )) as unknown as FeatureCollection<Geometry | null>,
  })
}

export const HISTORY_PAGE_SIZE = 20

/** Uploaded files, newest first; refreshes every second while any is still being processed. */
export function useFiles(offset: number) {
  return useQuery({
    queryKey: ['files', 'list', offset],
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/files/', { params: { query: { limit: HISTORY_PAGE_SIZE, offset } }, signal })),
    refetchInterval: (query) => (query.state.data?.items.some(isInProgress) ? POLL_INTERVAL_MS : false),
  })
}

/** Deletes a file and forgets everything cached about it. */
export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE('/api/files/{file_id}', { params: { path: { file_id: id } } })),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: fileKey(id) })
      return queryClient.invalidateQueries({ queryKey: ['files', 'list'] })
    },
  })
}
