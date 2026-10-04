import { useEffect, useId, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import { API, getAuthHeaders } from '../../utils/apiConfig'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'
export async function refundRequest(path, options = {}) {
  const response = await fetch(`${API}/api/appointments${path}`, { credentials: 'include', ...options,
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: options.body ? JSON.stringify(options.body) : undefined })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Refund request failed')
  return result.data
}
const labels = { pending: 'Refund Requested', processing: 'Refund Processing', refunded: 'Refunded', rejected: 'Refund Rejected' }
const inputClass = 'mt-1.5 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:ring-1 focus:ring-[var(--gold-primary)] disabled:opacity-60'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)]'
function RefundQrCode({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" className="block my-3 w-fit">
    <img src={url} alt="Refund destination QR code" className="w-48 h-48 object-contain rounded-lg bg-white p-2" />
    <span className="text-[var(--gold-primary)]">View refund QR code</span>
  </a>
}
export default function AppointmentRefund({ apt }) {
  const formId = useId()
  const [refund, setRefund] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ refund_method: apt.payment_method ? formatPaymentMethod(apt.payment_method) : '', destination_type: 'account', account_holder: '', account_number: '', reason: '' })
  const [qrFile, setQrFile] = useState(null)
  const [qrPreview, setQrPreview] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    if (!qrFile) { setQrPreview(''); return }
    const url = URL.createObjectURL(qrFile)
    setQrPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [qrFile])
  useEffect(() => {
    let live = true
    setLoaded(false)
    refundRequest(`/${apt.appointment_id}/refund-requests`).then(data => { if (live) { setRefund(data.refund_requests?.[0] || null); setLoaded(true) } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [apt.appointment_id, apt.payment_status])
  const handleQrFile = e => {
    const file = e.target.files?.[0]
    setQrFile(null)
    setQrUrl('')
    setError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WebP QR image up to 5 MB.')
      e.target.value = ''
      return
    }
    setQrFile(file)
  }
  const handleSubmit = async e => {
    e.preventDefault()
    if (form.destination_type === 'qr' && !qrFile) { setError('Upload your refund QR code.'); return }
    setBusy(true)
    setError('')
    try {
      const destination = form.destination_type === 'qr'
        ? { qr_code_url: qrUrl || await uploadToCloudinary(qrFile, { folder: 'cosmoscraft_assets/refund_qr_codes' }) }
        : { account_holder: form.account_holder, account_number: form.account_number }
      if (destination.qr_code_url) setQrUrl(destination.qr_code_url)
      const data = await refundRequest('/refund-requests', { method: 'POST', body: {
        appointment_id: apt.appointment_id, refund_method: form.refund_method,
        destination_type: form.destination_type, reason: form.reason, ...destination,
      } })
      setRefund(data.refund_request)
      setOpen(false)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  if (!['no_show', 'cancelled'].includes(String(apt.status || '').toLowerCase())) return null
  const supportsRefund = ['e_wallet', 'e_bank', 'gcash', 'bank_transfer'].includes(String(apt.payment_method || '').trim().toLowerCase())
  const eligible = supportsRefund && apt.payment_status === 'approved' && Number(apt.approved_payment_amount) > 0
  return <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-sm text-[var(--text-light)] sm:p-5">
    {refund ? <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="font-medium">{labels[refund.status]}</p>
        <p className="font-semibold tabular-nums">{formatCurrency(refund.amount_requested)}</p>
      </div>
      {refund.qr_code_url && <RefundQrCode url={refund.qr_code_url} />}
      {refund.refund_reference && <p className="text-xs text-[var(--text-muted)]">Reference: {refund.refund_reference}</p>}
      {refund.admin_notes && <p className="text-xs text-[var(--text-muted)]">{refund.admin_notes}</p>}
      {refund.proof_url && <a href={refund.proof_url} target="_blank" rel="noreferrer" className="inline-block text-xs underline underline-offset-4">View refund proof</a>}
    </div> : eligible && loaded ? <>
      {open ? <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Request a refund</h3>
          <button type="button" aria-label="Close refund form" disabled={busy} onClick={() => { setOpen(false); setError('') }} className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div aria-label="Original approved payment" className="mb-4 mt-3 flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="min-w-0 text-xs text-[var(--text-muted)]">
            <p>{formatPaymentMethod(apt.payment_method)} payment</p>
            <p className="mt-1 break-words">{apt.reference_code}</p>
            {apt.payment_proof_url && <a href={apt.payment_proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block underline underline-offset-4">View payment proof</a>}
          </div>
          <p className="shrink-0 text-base font-semibold tabular-nums">{formatCurrency(apt.approved_payment_amount)}</p>
        </div>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <label className={labelClass}>E-wallet / bank
            <input required maxLength={100} placeholder="e.g. GCash or BPI" value={form.refund_method} onChange={e => setForm({ ...form, refund_method: e.target.value })} className={inputClass} />
          </label>
          <div role="radiogroup" aria-label="Refund destination" className="flex gap-2">
            {[['account', 'Account number'], ['qr', 'QR code']].map(([value, label]) => <label key={value} className="min-w-0 flex-1 cursor-pointer">
              <input type="radio" name={`${formId}-destination`} value={value} checked={form.destination_type === value} onChange={() => { setForm({ ...form, destination_type: value }); setQrFile(null); setQrUrl(''); setError('') }} className="peer sr-only" />
              <span className="flex justify-center rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition peer-checked:border-[var(--gold-primary)] peer-checked:bg-[var(--bg-primary)] peer-checked:text-[var(--text-light)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--gold-primary)] peer-disabled:cursor-not-allowed">{label}</span>
            </label>)}
          </div>
          {form.destination_type === 'qr' ? <div>
            <label className="relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--border)] p-3 transition hover:border-[var(--gold-primary)] focus-within:ring-2 focus-within:ring-[var(--gold-primary)]">
              <input aria-label="Upload refund QR code" type="file" accept="image/png,image/jpeg,image/webp" required onChange={handleQrFile} className="sr-only" />
              {qrPreview ? <img src={qrPreview} alt="Refund QR code preview" className="h-16 w-16 shrink-0 rounded bg-white p-1 object-contain" /> : <Upload className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
              <span className="min-w-0">
                <span className="block text-xs font-medium">{qrFile ? 'Change QR image' : 'Upload QR code'}</span>
                <span className="mt-1 block break-all text-xs text-[var(--text-muted)]">{qrFile ? qrFile.name : 'PNG, JPG or WebP · Up to 5 MB'}</span>
              </span>
            </label>
          </div> : <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Account holder name<input required autoComplete="name" maxLength={200} placeholder="Full name" value={form.account_holder} onChange={e => setForm({ ...form, account_holder: e.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Account number<input aria-label="Account number / registered mobile number" required maxLength={100} placeholder="Bank or mobile number" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className={inputClass} /></label>
          </div>}
          <details className="text-xs text-[var(--text-muted)]">
            <summary className="w-fit cursor-pointer">Add a note (optional)</summary>
            <label className={`${labelClass} mt-2`}>Reason<textarea rows={2} maxLength={2000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className={`${inputClass} resize-y`} /></label>
          </details>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--text-muted)]">Sent manually after review.</p>
            <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--text-dark)] transition hover:bg-[var(--gold-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:cursor-wait disabled:opacity-60">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}{busy ? 'Submitting...' : 'Submit refund request'}
            </button>
          </div>
        </fieldset>
      </form> : <button type="button" onClick={() => setOpen(true)} className="font-medium underline decoration-[var(--border)] underline-offset-4 transition hover:decoration-[var(--gold-primary)]">Request Refund</button>}
    </> : <>
      <button type="button" disabled className="font-medium opacity-50 cursor-not-allowed">Request Refund</button>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{supportsRefund ? 'Refund requests require an approved payment with a confirmed amount.' : 'Refund requests are available only for e-wallet or bank payments.'}</p>
    </>}
    {error && !open && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
  </div>
}
export function AppointmentRefundAdmin({ appointment }) {
  const appointmentId = appointment?.appointment_id || appointment?.id
  const [rows,setRows] = useState([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [draft,setDraft] = useState({})
  const load = async () => {
    if (!appointmentId) return
    setError('')
    try { const data = await refundRequest(`/${appointmentId}/refund-requests`); setRows(data.refund_requests || []) } catch (e) { setError(e.message) }
  }
  useEffect(() => {
    let live = true
    setRows([])
    setDraft({})
    setError('')
    if (appointmentId) refundRequest(`/${appointmentId}/refund-requests`).then(data => { if (live) setRows(data.refund_requests || []) }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [appointmentId, appointment?.payment_status])
  const update = async (row,status) => { setBusy(true); setError(''); try { await refundRequest(`/refund-requests/${row.refund_request_id}`,{method:'PATCH',body:{...draft[row.refund_request_id],status}}); await load() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  if (!appointmentId || (!rows.length && !error)) return null
  const customerName = appointment.customer_name || appointment.user_name || appointment.customerName || [appointment.first_name, appointment.last_name].filter(Boolean).join(' ') || 'Customer'
  return <section aria-label="Appointment refund request" className="mt-4 p-4 border border-[var(--border)] rounded-xl text-[var(--text-light)]"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Refund request</h3><button type="button" disabled={busy} onClick={load} className="text-xs text-[var(--text-muted)] underline underline-offset-4">Refresh</button></div>{error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    {rows.map(r => <div key={r.refund_request_id} className="p-4 my-3 border border-[var(--border)] rounded-lg">
      <p className="font-medium">{customerName} requested a refund.</p>
      <p>{labels[r.status]} {formatCurrency(r.amount_requested)}</p>
      <p>Original approved payment: {formatPaymentMethod(r.original_payment?.payment_method || appointment.payment_method)} &middot; {formatCurrency(r.original_payment?.amount ?? r.amount_requested)}</p>
      {r.original_payment?.payment_proof_url && <a href={r.original_payment.payment_proof_url} target="_blank" rel="noreferrer">Original payment proof</a>}
      <p>Refund destination: {formatPaymentMethod(r.refund_method)}</p>
      {r.qr_code_url ? <RefundQrCode url={r.qr_code_url} /> : <p>{r.account_holder} {r.account_number}</p>}
      {r.reason && <p>Reason: {r.reason}</p>}
      {r.refund_reference && <p>Refund reference: {r.refund_reference}</p>}{r.admin_notes && <p>{r.admin_notes}</p>}{r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer">Completed refund proof</a>}
      {['pending','processing'].includes(r.status) && <>
        {[['refund_reference','Refund transaction reference'],['proof_url','Refund proof HTTPS link'],['admin_notes','Admin notes / rejection reason']].map(([key,label]) => <label key={key} className="block my-2">{label}<input maxLength={2000} className="block w-full p-2 bg-white/10 rounded" value={draft[r.refund_request_id]?.[key] || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],[key]:e.target.value}})} /></label>)}
        {(r.status === 'pending' ? ['processing','rejected'] : ['refunded','rejected']).map(status => <button disabled={busy} key={status} onClick={() => update(r,status)} className="p-2 mr-2 border rounded">Mark {status}</button>)}
      </>}
    </div>)}
  </section>
}
