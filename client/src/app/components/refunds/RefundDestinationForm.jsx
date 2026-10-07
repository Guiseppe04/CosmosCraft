import RefundImageInput from './RefundImageInput'
import { emptyRefundDestination } from '../../utils/refundWorkflow'

export default function RefundDestinationForm({ value, onChange, disabled, onBusyChange }) {
  const requireAccountDetails = !(value.method === 'e_wallet' && value.qrImage)
  function field(key, label, maxLength) {
    return <label className="block text-sm text-[var(--text-light)]">{label} {requireAccountDetails ? <span className="text-red-400">*</span> : '(optional)'}
      <input required={requireAccountDetails} maxLength={maxLength} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}
        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm" />
    </label>
  }
  return <fieldset disabled={disabled} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
    <legend className="px-2 text-sm font-semibold text-[var(--text-light)]">Refund request: payment destination</legend>
    <label className="block text-sm text-[var(--text-light)]">Preferred refund method <span className="text-red-400">*</span>
      <select required value={value.method} onChange={e => onChange({ ...emptyRefundDestination(), method: e.target.value })}
        className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm">
        <option value="">Select a method</option><option value="e_wallet">E-Wallet</option><option value="e_bank">E-Bank / Bank Transfer</option>
      </select>
    </label>
    {value.method && <>
      {value.method === 'e_wallet' && <p className="text-xs text-[var(--text-muted)]">Upload a QR code to make the provider, account name, and mobile number optional. Without a QR code, fill in all three fields.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('provider', value.method === 'e_wallet' ? 'E-Wallet provider' : 'Bank / E-Bank name', 100)}
        {field('accountName', 'Account name', 150)}
      </div>
      {field('accountNumber', value.method === 'e_wallet' ? 'Wallet account / mobile number' : 'Account number', 40)}
      <label className="block text-sm text-[var(--text-light)]">Other payment details (optional)
        <textarea rows={2} maxLength={500} value={value.details} onChange={e => onChange({ ...value, details: e.target.value })}
          placeholder="Branch, routing code, or instructions needed by your provider."
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm" />
      </label>
      {value.method === 'e_wallet' && <RefundImageInput label="E-Wallet QR code (optional)" value={value.qrImage}
        onChange={qrImage => onChange({ ...value, qrImage })} disabled={disabled} onBusyChange={onBusyChange} />}
      <p className="text-xs text-[var(--text-muted)]">Check your details carefully. Payment details and submitted QR codes are accessible only to authorized admins. You can replace or remove the QR code before submitting.</p>
    </>}
  </fieldset>
}
