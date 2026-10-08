import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import type { FileInfo } from '@/lib/api/types'

type DeleteSheetProps = {
  file: FileInfo | null
  deleting: boolean
  onConfirm: (file: FileInfo) => void
  onCancel: () => void
}

/** Confirms a delete. Focus starts on the close button and Cancel comes first: nothing is deleted by accident. */
export function DeleteSheet({ file, deleting, onConfirm, onCancel }: DeleteSheetProps) {
  return (
    <Sheet
      open={file !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={file ? `Delete ${file.filename}?` : 'Delete file?'}
      description="The file, its features and its measurements are removed from the server. This cannot be undone."
    >
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          loading={deleting}
          onClick={() => {
            if (file) onConfirm(file)
          }}
        >
          Delete file
        </Button>
      </div>
    </Sheet>
  )
}
