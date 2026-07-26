import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { ADJUSTMENT_REASONS } from '../../constants/stockAdjustment'

export function ReasonSelector({ value, onChange }) {
  const groupedReasons = useMemo(() => {
    const groups = {}
    ADJUSTMENT_REASONS.forEach((reason) => {
      if (!groups[reason.group]) groups[reason.group] = []
      groups[reason.group].push(reason)
    })
    return groups
  }, [])

  const selectedReason = ADJUSTMENT_REASONS.find((reason) => reason.value === value)
  const needsNotes = selectedReason?.requiresNotes

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
      >
        <option value="">— Select Reason —</option>
        {Object.entries(groupedReasons).map(([group, reasons]) => (
          <optgroup key={group} label={group}>
            {reasons.map((reason) => (
              <option key={reason.value} value={reason.value}>{reason.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {needsNotes && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Notes required for this reason
        </p>
      )}
    </div>
  )
}

export default ReasonSelector
