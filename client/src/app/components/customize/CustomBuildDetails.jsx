import { getCustomBuildDetailGroups } from '../../utils/customBuildSummary.js'
import { formatPeso } from '../../utils/buildConfigurationLineItems.js'

export default function CustomBuildDetails({ item, defaultOpen = false }) {
  const groups = getCustomBuildDetailGroups(item)
  if (!groups.length) return null
  return (
    <details open={defaultOpen || undefined} className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/40 text-[var(--text-light)]">
      <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--gold-primary)] focus-visible:ring-2 focus-visible:ring-[var(--gold-primary)]">View build details</summary>
      <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain border-t border-[var(--border)] p-3">
        {groups.map(group => (
          <details key={group.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)]">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">{group.label} <span className="text-[var(--text-muted)]">({group.items.length})</span></summary>
            <dl className="space-y-2 border-t border-[var(--border)] p-3">
              {group.items.map(line => (
                <div key={line.id} className="flex min-w-0 items-start justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <dt className="text-[var(--text-muted)]">{line.label}</dt>
                    <dd className="mt-0.5 break-words leading-relaxed">{line.name}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</dd>
                  </div>
                  {line.subtotal != null && Number.isFinite(Number(line.subtotal)) && (
                    <dd className="shrink-0 text-right tabular-nums text-[var(--gold-primary)]">{Number(line.subtotal) === 0 ? 'Included' : formatPeso(line.subtotal)}</dd>
                  )}
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </details>
  )
}
