import { useMemo } from 'react'
import { formatPeso } from '../../utils/buildConfigurationLineItems.js'

export function BuilderConfigurationPanel({
  lineItems = [],
  configurationTotal = 0,
  loadingPrices = false,
  title = 'Your Configuration',
}) {
  const groupedItems = useMemo(() => {
    return lineItems.reduce((groups, item) => {
      const existing = groups.find((group) => group.category === item.category)
      if (existing) {
        existing.items.push(item)
      } else {
        groups.push({ category: item.category, items: [item] })
      }
      return groups
    }, [])
  }, [lineItems])

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        {title}
      </h3>

      {loadingPrices ? (
        <p className="text-xs text-[var(--text-muted)]">Loading prices…</p>
      ) : (
        <div className="space-y-4">
          {groupedItems.map((group) => (
            <div key={group.category} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d4af37]/80">
                {group.category}
              </p>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-[var(--text-light)]">
                      <span className="text-[var(--text-muted)]">– </span>
                      {item.name}
                    </p>
                    {item.quantity > 1 && (
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        Qty: {item.quantity}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold tabular-nums text-[#d4af37]">
                      {formatPeso(item.subtotal)}
                    </p>
                    {item.quantity > 1 && (
                      <p className="mt-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                        {formatPeso(item.unitPrice)} ea.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
                Configuration Total
              </span>
              <span className="text-sm font-bold tabular-nums text-[#d4af37]">
                {formatPeso(configurationTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
