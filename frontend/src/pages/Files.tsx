import { FolderOpen } from 'lucide-react'
import { useState } from 'react'

import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/toastContext'
import { DeleteSheet } from '@/features/history/DeleteSheet'
import { HistoryList } from '@/features/history/HistoryList'
import { HISTORY_PAGE_SIZE, useDeleteFile, useFiles } from '@/lib/api/hooks'
import type { FileInfo } from '@/lib/api/types'
import { formatNumber } from '@/lib/format'

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-4 py-16 text-center sm:py-20">
      <span className="flex size-14 items-center justify-center rounded-full bg-fill text-text-secondary">
        <Icon icon={FolderOpen} size={28} />
      </span>
      <h2 className="text-title-3">No files yet</h2>
      <p className="max-w-prose text-body text-text-secondary">
        Measure your first Shapefile or KML. It takes a few seconds, and the results stay here.
      </p>
      <ButtonLink to="/#upload">Upload a file</ButtonLink>
    </Card>
  )
}

export default function Files() {
  const [offset, setOffset] = useState(0)
  const [pending, setPending] = useState<FileInfo | null>(null)
  const files = useFiles(offset)
  const remove = useDeleteFile()
  const toast = useToast()

  function confirmDelete(file: FileInfo) {
    remove.mutate(file.id, {
      onSuccess: () => {
        toast(`Deleted ${file.filename}`)
        setPending(null)
        // The last file on a later page: step back so the page is not empty.
        if (items.length === 1 && offset > 0) setOffset(offset - HISTORY_PAGE_SIZE)
      },
      onError: (error) => {
        toast(`Could not delete ${file.filename}. ${error.message}`)
        setPending(null)
      },
    })
  }

  const total = files.data?.total ?? 0
  const items = files.data?.items ?? []

  return (
    <div className="mx-auto flex max-w-workspace flex-col gap-8 px-5.5 py-10 sm:px-10 sm:py-12">
      <title>Files · Geo Measure</title>
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1">Files</h1>
        <p className="text-body text-text-secondary">Every file you have uploaded, newest first.</p>
      </div>

      {files.isPending ? (
        <div aria-busy="true" aria-label="Loading files" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : files.isError ? (
        <Card role="alert" className="flex flex-col items-start gap-4">
          <p className="text-body">The list of files could not be loaded. {files.error.message}</p>
          <Button onClick={() => void files.refetch()}>Try again</Button>
        </Card>
      ) : total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <HistoryList files={items} onDelete={setPending} />
          {total > HISTORY_PAGE_SIZE && (
            <nav
              aria-label="Pages"
              className="flex items-center justify-between gap-3 text-caption text-text-secondary"
            >
              <Button
                variant="secondary"
                disabled={offset === 0}
                onClick={() => {
                  setOffset(Math.max(0, offset - HISTORY_PAGE_SIZE))
                }}
              >
                Newer
              </Button>
              <span aria-live="polite">
                {formatNumber(offset + 1, 0)}–{formatNumber(offset + items.length, 0)} of{' '}
                {formatNumber(total, 0)}
              </span>
              <Button
                variant="secondary"
                disabled={offset + HISTORY_PAGE_SIZE >= total}
                onClick={() => {
                  setOffset(offset + HISTORY_PAGE_SIZE)
                }}
              >
                Older
              </Button>
            </nav>
          )}
        </>
      )}

      <DeleteSheet
        file={pending}
        deleting={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPending(null)
        }}
      />
    </div>
  )
}
