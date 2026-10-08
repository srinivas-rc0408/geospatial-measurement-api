import { Download, Link2, TriangleAlert } from 'lucide-react'

import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StatusPill } from '@/components/ui/StatusPill'
import { useToast } from '@/components/ui/toastContext'
import { API_BASE_URL } from '@/lib/api/client'
import type { FileInfo } from '@/lib/api/types'
import { fileTypeLabel, formatCount, formatDateTime } from '@/lib/format'

type ResultsHeaderProps = {
  file: FileInfo
  /** Saves the GeoJSON already loaded for the map; absent until it has loaded. */
  onDownload?: (() => void) | undefined
}

export function ResultsHeader({ file, onDownload }: ResultsHeaderProps) {
  const toast = useToast()
  const count = file.feature_count
  const meta = [
    fileTypeLabel(file.file_type),
    file.crs && `Source CRS ${file.crs}`,
    count != null && formatCount(count, 'feature'),
    file.processed_at && `Processed ${formatDateTime(file.processed_at)}`,
  ].filter(Boolean)

  async function copyApiLink() {
    try {
      await navigator.clipboard.writeText(`${API_BASE_URL}/api/files/${file.id}`)
      toast('API link copied')
    } catch {
      toast('Could not copy. Your browser blocked clipboard access.')
    }
  }

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 text-title-2 break-words">{file.filename}</h1>
            <StatusPill status={file.status} live />
          </div>
          <p className="text-caption text-text-secondary">
            {meta.join(' · ')}
            {file.crs && <span className="sr-only"> (CRS: coordinate reference system)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDownload && (
            <Button variant="secondary" onClick={onDownload}>
              <Icon icon={Download} size={18} />
              Download GeoJSON
            </Button>
          )}
          <Button variant="secondary" onClick={() => void copyApiLink()}>
            <Icon icon={Link2} size={18} />
            Copy API link
          </Button>
          <ButtonLink to="/#upload" variant="ghost" chevron>
            Upload another
          </ButtonLink>
        </div>
      </div>
      {file.warnings && file.warnings.length > 0 && (
        <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-callout">
          <Icon icon={TriangleAlert} className="mt-0.5 shrink-0 text-warning" />
          <ul className="flex flex-col gap-1 text-text">
            {file.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
