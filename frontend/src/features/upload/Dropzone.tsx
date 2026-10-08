import { CircleAlert, FileUp } from 'lucide-react'
import { m } from 'motion/react'
import { useRef, useState, type DragEvent, type RefObject } from 'react'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB, type Problem } from './validateFile'

type DropzoneProps = {
  onFile: (file: File) => void
  onProblem: (problem: Problem) => void
  problem: Problem | null
  /** The hidden file input, so other controls (the hero button) can open the picker. */
  inputRef: RefObject<HTMLInputElement | null>
}

/** Drop target plus a "Choose file" button (the keyboard path). Problems show inline, below. */
export function Dropzone({ onFile, onProblem, problem, inputRef }: DropzoneProps) {
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave also fire for child elements; count them so the highlight does not flicker.
  const depth = useRef(0)

  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    depth.current += 1
    setDragging(true)
  }
  function onDragLeave() {
    depth.current -= 1
    if (depth.current === 0) setDragging(false)
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    const files = event.dataTransfer.files
    if (files.length > 1) {
      onProblem({
        message: 'Drop one file at a time.',
        hint: 'Zip a Shapefile’s parts together into one .zip.',
      })
      return
    }
    const file = files[0]
    if (file) onFile(file)
  }

  return (
    <m.div layoutId="upload-card" className="flex flex-col gap-4">
      {/* Dropping is a pointer-only shortcut; the "Choose file" button inside is the keyboard path. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drag events only */}
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className="flex flex-col items-center gap-4 rounded-lg border-1.5 border-dashed border-separator bg-surface px-6 py-12 text-center transition duration-250 ease-standard data-dragging:scale-101 data-dragging:border-accent data-dragging:bg-surface-elevated sm:py-16"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-fill text-accent">
          <Icon icon={FileUp} size={28} />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-title-3">Drop a .zip, .kml or .kmz here</p>
          <p className="text-caption text-text-secondary">
            Max {MAX_UPLOAD_MB} MB · Shapefile ZIP must include .shp, .shx and .dbf
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            inputRef.current?.click()
          }}
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a file to measure"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = '' // so choosing the same file again still fires change
            if (file) onFile(file)
          }}
        />
      </div>
      {problem && (
        <div role="alert" className="flex gap-3 rounded-md bg-surface px-4 py-3 text-callout">
          <Icon icon={CircleAlert} className="mt-0.5 text-danger" />
          <div className="flex flex-col gap-0.5">
            <p className="text-text">{problem.message}</p>
            {problem.hint && <p className="text-text-secondary">{problem.hint}</p>}
          </div>
        </div>
      )}
    </m.div>
  )
}
