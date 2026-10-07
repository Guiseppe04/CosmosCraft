import { formatCurrency } from '../utils/formatCurrency'
import { SHIPPING_FEE_NOTE } from '../utils/shippingFee'

export function ShippingFeeNotice({ fee, title = 'Additional shipping fee (paid separately)' }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-2">
      <p className="text-sm font-semibold text-[var(--text-light)]">{title}</p>
      {fee !== undefined && fee !== null && fee !== '' && Number.isFinite(Number(fee)) && (
        <p className="text-base font-semibold text-[var(--gold-primary)]">{formatCurrency(Number(fee))}</p>
      )}
      <p className="text-sm text-[var(--text-muted)]">{SHIPPING_FEE_NOTE}</p>
    </div>
  )
}

export function ShippingFeeInput({ value, onChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-[var(--text-muted)]">
        Additional shipping fee (PHP) <span className="text-red-400">*</span>
        <input type="number" min="0" max="9999999999.99" step="0.01" required
          value={value ?? ''} onChange={(event) => onChange(event.target.value)}
          placeholder="Enter shipping fee"
          className="mt-2 w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-[var(--text-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]" />
      </label>
      <p className="text-xs text-[var(--text-muted)]">{SHIPPING_FEE_NOTE}</p>
    </div>
  )
}
