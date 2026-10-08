import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { StatusPill } from '@/components/ui/StatusPill'
import { useFileSummary } from '@/lib/api/hooks'
import type { FileInfo } from '@/lib/api/types'
import {
  fileTypeLabel,
  formatArea,
  formatCount,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  MISSING,
} from '@/lib/format'

type HistoryListProps = { files: FileInfo[]; onDelete: (file: FileInfo) => void }

/** Total area needs the file's measurement summary; it is fetched (once, cached) for completed files only. */
function TotalArea({ file }: { file: FileInfo }) {
  const { data } = useFileSummary(file.id, file.status === 'COMPLETED')
  return <>{data ? formatArea(data.total_area_m2, 'ha') : MISSING}</>
}

function Time({ value }: { value: string }) {
  return (
    <time dateTime={value} title={formatDateTime(value)}>
      {formatRelativeTime(value)}
    </time>
  )
}

const features = (file: FileInfo) =>
  file.feature_count == null ? MISSING : formatNumber(file.feature_count, 0)
const featureCount = (file: FileInfo) =>
  file.feature_count == null ? 'features unknown' : formatCount(file.feature_count, 'feature')

function DeleteButton({ file, onDelete }: { file: FileInfo; onDelete: (file: FileInfo) => void }) {
  return (
    <button
      type="button"
      aria-label={`Delete ${file.filename}`}
      title="Delete"
      onClick={() => {
        onDelete(file)
      }}
      className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-fill-hover hover:text-danger"
    >
      <Icon icon={Trash2} size={18} />
    </button>
  )
}

export function HistoryList({ files, onDelete }: HistoryListProps) {
  return (
    <>
      <table className="hidden w-full border-separate border-spacing-0 rounded-md border border-separator text-callout sm:table">
        <caption className="sr-only">Uploaded files, newest first</caption>
        <thead>
          <tr className="text-caption text-text-secondary">
            {['File', 'Status', 'Features', 'Total area', 'Uploaded'].map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`bg-bg-secondary px-3 py-2.5 font-semibold ${index === 0 ? 'rounded-tl-md text-left' : index === 1 ? 'text-left' : 'text-right'}`}
              >
                {label}
              </th>
            ))}
            <th scope="col" className="rounded-tr-md bg-bg-secondary px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="relative transition-colors duration-150 hover:bg-fill/60">
              <td className="border-t border-separator px-3 py-2">
                {/* The link stretches over the row; the delete button sits above it. */}
                <Link
                  to={`/files/${file.id}`}
                  className="font-semibold break-all after:absolute after:inset-0 after:content-['']"
                >
                  {file.filename}
                </Link>
                <p className="text-caption text-text-secondary">{fileTypeLabel(file.file_type)}</p>
              </td>
              <td className="border-t border-separator px-3 py-2">
                <StatusPill status={file.status} />
              </td>
              <td className="border-t border-separator px-3 py-2 text-right tabular-nums">
                {features(file)}
              </td>
              <td className="border-t border-separator px-3 py-2 text-right whitespace-nowrap tabular-nums">
                <TotalArea file={file} />
              </td>
              <td className="border-t border-separator px-3 py-2 text-right whitespace-nowrap text-text-secondary">
                <Time value={file.created_at} />
              </td>
              <td className="border-t border-separator px-1 py-1 text-right">
                <DeleteButton file={file} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-2 sm:hidden" aria-label="Uploaded files">
        {files.map((file) => (
          <li key={file.id} className="relative flex items-center gap-2 rounded-md bg-surface py-3 pr-1 pl-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                to={`/files/${file.id}`}
                className="truncate text-body font-semibold after:absolute after:inset-0 after:content-['']"
              >
                {file.filename}
              </Link>
              <p className="text-caption text-text-secondary">
                {fileTypeLabel(file.file_type)} · {featureCount(file)} · <TotalArea file={file} /> ·{' '}
                <Time value={file.created_at} />
              </p>
              <div>
                <StatusPill status={file.status} />
              </div>
            </div>
            <DeleteButton file={file} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </>
  )
}
