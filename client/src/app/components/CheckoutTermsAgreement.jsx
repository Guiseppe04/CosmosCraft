import { TERMS_BY_TYPE } from '../utils/checkoutTerms'

export default function CheckoutTermsAgreement({ types, accepted, onViewTerms, onToggleTerms, error }) {
  return (
    <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/10 p-4 space-y-4">
      {types.length > 1 && <p className="text-xs text-[var(--text-muted)]">Your checkout includes regular products and a custom build. Please review and accept both agreements.</p>}
      {types.map((type) => (
        <div key={type}>
          <button type="button" onClick={() => onViewTerms(type)}
            className="text-sm font-medium text-[var(--gold-primary)] hover:underline">
            {TERMS_BY_TYPE[type].label}
          </button>
          <label className="mt-2 flex items-start gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={accepted[type] === true}
              onChange={(event) => onToggleTerms(type, event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border)] bg-[var(--bg-primary)] text-[var(--gold-primary)] focus:ring-[var(--gold-primary)]" />
            <span>I have read and agree to the {TERMS_BY_TYPE[type].label}.</span>
          </label>
        </div>
      ))}
      {error && <p role="alert" className="text-xs font-medium text-red-400">{error}</p>}
    </div>
  )
}
