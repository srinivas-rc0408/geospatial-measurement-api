type StatProps = { label: string; value: string; unit?: string }

/** A caption label above a big tabular number; the unit is smaller and secondary. */
export function Stat({ label, value, unit }: StatProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="text-stat">
        {value}
        {unit && <span className="ml-1 text-title-3 font-normal text-text-secondary">{unit}</span>}
      </p>
    </div>
  )
}
