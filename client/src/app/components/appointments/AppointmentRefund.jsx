import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSocketEvent } from '../../context/SocketContext.jsx'
import { Loader2, Upload, X, RotateCcw, RefreshCw, CreditCard, Wallet } from 'lucide-react'
import { API, getAuthHeaders } from '../../utils/apiConfig'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatPaymentMethod } from '../../utils/paymentMethodUtils'
export async function refundRequest(path, options = {}) {
  const { timeoutMs = 30000, ...requestOptions } = options
  try {
    const response = await fetch(`${API}/api/appointments${path}`, { credentials: 'include', ...requestOptions,
      signal: requestOptions.signal || AbortSignal.timeout(timeoutMs),
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: options.body ? JSON.stringify(options.body) : undefined })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(result?.errors?.map(error => error.message).join(' ') || result?.message || `Refund request failed (${response.status}). Please try again.`)
    if (!result?.data) throw new Error('The server returned an unexpected response. Please try again.')
    return result.data
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The refund request timed out. Check your connection and refresh the refund status before trying again.')
    throw error
  }
}
const labels = { pending: 'Refund Requested', processing: 'Processing', refunded: 'Refund Completed', rejected: 'Refund Rejected' }
const inputClass = 'mt-1.5 block w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-light)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:ring-1 focus:ring-[var(--gold-primary)] disabled:opacity-60'
const labelClass = 'block text-xs font-medium text-[var(--text-muted)]'
function useAppointmentRefunds(appointmentId, paymentStatus) {
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  const load = useCallback(async () => {
    if (!appointmentId) return
    const requestVersion = ++version.current
    try {
      const data = await refundRequest(`/${appointmentId}/refund-requests`)
      if (requestVersion === version.current) { setRows(data.refund_requests || []); setLoaded(true); setError('') }
    } catch (e) { if (requestVersion === version.current) setError(e.message) }
  }, [appointmentId])
  useEffect(() => {
    setRows([])
    setLoaded(false)
    setError('')
    load()
    return () => { version.current++ }
  }, [load, paymentStatus])
  useSocketEvent('appointment:updated', event => {
    if (!event?.appointment_id || event.appointment_id === appointmentId) load()
  })
  useSocketEvent('connect', load)
  return { rows, setRows, loaded, error, setError, load }
}
function RefundImagePreview({ url, title, alt }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return <>
    <button type="button" onClick={() => dialogRef.current?.showModal()} className="my-3 block w-48 max-w-full rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]">
      <img src={url} alt={alt} className="aspect-square w-full rounded-lg bg-white p-2 object-contain" />
      <span className="mt-2 block text-xs font-medium text-[var(--gold-primary)]">{title}</span>
    </button>
    {createPortal(<dialog ref={dialogRef} aria-labelledby={titleId} onKeyDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) dialogRef.current.close() }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-0 text-[var(--text-light)] shadow-2xl backdrop:bg-black/80">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <h3 id={titleId} className="text-sm font-semibold">{title}</h3>
        <button type="button" aria-label="Close image preview" onClick={() => dialogRef.current.close()} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)]"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <div className="p-4"><img src={url} alt={`${alt} enlarged`} className="mx-auto max-h-[70vh] max-w-full rounded-lg bg-white object-contain" /></div>
    </dialog>, document.body)}
  </>
}
function RefundQrCode({ url }) {
  return <RefundImagePreview url={url} title="View refund QR code" alt="Refund destination QR code" />
}
function RefundProofUpload({ file, savedUrl, onChange, onError }) {
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <div className="sm:col-span-2">
    <p className={labelClass}>Refund payment proof</p>
    <label className="relative mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 transition hover:border-[var(--gold-primary)] focus-within:ring-2 focus-within:ring-[var(--gold-primary)]">
      <input type="file" aria-label="Upload refund payment proof" accept="image/png,image/jpeg,image/webp" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={e => {
        const selected = e.target.files?.[0]
        if (!selected) return
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) {
          onError('Choose a PNG, JPG, or WebP refund proof image up to 5 MB.')
          e.target.value = ''
          return
        }
        onError('')
        onChange(selected)
        e.target.value = ''
      }} />
      <Upload className="h-5 w-5 shrink-0 text-[var(--gold-primary)]" aria-hidden="true" />
      <span className="min-w-0"><span className="block text-xs font-medium">{file ? 'Change refund proof image' : 'Upload refund proof image'}</span><span className="mt-1 block break-all text-xs text-[var(--text-muted)]">{file ? file.name : 'PNG, JPG or WebP · Up to 5 MB'}</span></span>
    </label>
    {preview && <RefundImagePreview url={preview} title="Preview refund proof" alt="Selected refund proof" />}
    {!preview && savedUrl && <RefundImagePreview url={savedUrl} title="Preview refund proof" alt="Uploaded refund proof" />}
    {file && <button type="button" onClick={() => onChange(null)} className="text-xs text-[var(--text-muted)] underline underline-offset-4">Remove selected image</button>}
    <p className="mt-2 text-xs text-[var(--text-muted)]">The customer can view this image after you save the refund status.</p>
  </div>
}
export default function AppointmentRefund({ apt }) {
  const formId = useId()
  const { rows, setRows, loaded, error, setError } = useAppointmentRefunds(apt.appointment_id, apt.payment_status)
  const refund = rows[0] || null
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
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
      setRows([data.refund_request])
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
      {refund.proof_url && <RefundImagePreview url={refund.proof_url} title="View refund proof" alt="Refund payment proof" />}
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
  const { rows, setRows, error: loadError, load } = useAppointmentRefunds(appointmentId, appointment?.payment_status)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [saveStage,setSaveStage] = useState('')
  const [draft,setDraft] = useState({})
  const [proofFiles,setProofFiles] = useState({})
  const [rejecting,setRejecting] = useState({})
  useEffect(() => {
    setDraft({})
    setProofFiles({})
    setRejecting({})
    setError('')
  }, [appointmentId, appointment?.payment_status])
  const update = async (row,status) => {
    const id = row.refund_request_id
    const values = status === 'processing' ? {} : { ...draft[id] }
    if (status === 'refunded') {
      values.refund_reference = String(values.refund_reference || row.refund_reference || '').trim()
      values.proof_url = values.proof_url || row.proof_url
    }
    if (status === 'refunded' && !values.refund_reference && !proofFiles[id] && !values.proof_url) { setError('Upload a refund proof image or enter the refund transaction reference before marking the refund complete.'); return }
    if (status === 'rejected' && !String(values.admin_notes || '').trim()) { setError('Enter a rejection reason.'); return }
    setBusy(true)
    setError('')
    try {
      if (proofFiles[id] && status === 'refunded') {
        setSaveStage('Uploading refund proof…')
        values.proof_url = await uploadToCloudinary(proofFiles[id], { folder: 'cosmoscraft_assets/appointments/refund_proofs', timeoutMs: 45000 })
        setDraft(current => ({ ...current, [id]: { ...current[id], proof_url: values.proof_url } }))
        setProofFiles(current => ({ ...current, [id]: null }))
      }
      setSaveStage('Saving refund status…')
      const data = await refundRequest(`/refund-requests/${id}`, { method:'PATCH', body:{ ...values,status } })
      if (data.refund_request) setRows(current => current.map(request => request.refund_request_id === id ? data.refund_request : request))
      await load()
    } catch(e) { setError(e.message) } finally { setBusy(false); setSaveStage('') }
  }
  if (!appointmentId || (!rows.length && !loadError)) return null
  const customerName = appointment.customer_name || appointment.user_name || appointment.customerName || [appointment.first_name, appointment.last_name].filter(Boolean).join(' ') || 'Customer'
  const statusStyles = {
    pending: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
    processing: 'border-blue-500/25 bg-blue-500/10 text-blue-400',
    refunded: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
    rejected: 'border-red-500/25 bg-red-500/10 text-red-400',
  }
  const detailLabel = 'text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]'
  return <section aria-label="Appointment refund request" className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-light)]">
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-primary)]/10 text-[var(--gold-primary)]"><RotateCcw className="h-5 w-5" aria-hidden="true" /></span>
        <div><h3 className="text-sm font-semibold">Refund request</h3><p className="mt-0.5 text-xs text-[var(--text-muted)]">Review payment details and manage the refund.</p></div>
      </div>
      <button type="button" disabled={busy} onClick={load} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Refresh</button>
    </div>
    {loadError && <p role="alert" className="mx-4 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 sm:mx-5">{loadError}</p>}
    <div className="space-y-4 p-4 sm:p-5">
      {rows.map(r => <article key={r.refund_request_id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-4 sm:p-5">
          <div className="min-w-0"><p className={detailLabel}>Requested amount</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--gold-primary)]">{formatCurrency(r.amount_requested)}</p><p className="mt-2 break-words text-xs text-[var(--text-muted)]">{customerName} requested a refund.</p></div>
          <span role="status" className={`rounded-full border px-3 py-1.5 text-xs font-medium ${statusStyles[r.status] || 'border-[var(--border)] text-[var(--text-muted)]'}`}>{labels[r.status] || r.status}</span>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-[var(--border)] p-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold"><CreditCard className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />Original approved payment</h4>
              <p className="mt-3 text-lg font-semibold tabular-nums">{formatCurrency(r.original_payment?.amount ?? r.amount_requested)}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{formatPaymentMethod(r.original_payment?.payment_method || appointment.payment_method)}</p>
              {(r.original_payment?.payment_proof_url || appointment.payment_proof_url) && <RefundImagePreview url={r.original_payment?.payment_proof_url || appointment.payment_proof_url} title="View payment proof" alt="Original payment proof" />}
            </div>
            <div className="min-w-0 rounded-xl border border-[var(--border)] p-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold"><Wallet className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />Refund destination</h4>
              <p className="mt-3 text-sm font-medium">{formatPaymentMethod(r.refund_method)}</p>
              {r.qr_code_url ? <RefundQrCode url={r.qr_code_url} /> : <dl className="mt-3 space-y-2 text-xs"><div><dt className="text-[var(--text-muted)]">Account holder</dt><dd className="mt-0.5 break-words font-medium">{r.account_holder || 'Not provided'}</dd></div><div><dt className="text-[var(--text-muted)]">Account number</dt><dd className="mt-0.5 break-all font-mono">{r.account_number || 'Not provided'}</dd></div></dl>}
            </div>
          </div>
          {r.status !== 'pending' && <div className="rounded-xl border border-[var(--border)] p-4"><p className={detailLabel}>Customer reason</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.reason || 'No reason provided.'}</p></div>}
          {(r.refund_reference || r.admin_notes || r.proof_url) && <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            {r.refund_reference && <div><p className={detailLabel}>Refund reference</p><p className="mt-1 break-all font-mono text-xs">{r.refund_reference}</p></div>}
            {r.admin_notes && <div><p className={detailLabel}>Admin notes</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.admin_notes}</p></div>}
            {r.proof_url && <RefundImagePreview url={r.proof_url} title="Completed refund proof" alt="Refund payment proof" />}
          </div>}
          {r.status === 'pending' && <div className="border-t border-[var(--border)] pt-4">
            {error && <p role="alert" className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}
            {rejecting[r.refund_request_id] && <label className={`${labelClass} mb-3`}>Rejection reason<textarea disabled={busy} rows={3} maxLength={2000} className={`${inputClass} resize-y`} value={draft[r.refund_request_id]?.admin_notes || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],admin_notes:e.target.value}})} /></label>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {rejecting[r.refund_request_id] && <button type="button" disabled={busy} onClick={() => { setRejecting(current => ({ ...current, [r.refund_request_id]: false })); setError('') }} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-xs text-[var(--text-muted)]">Cancel rejection</button>}
              <button type="button" disabled={busy} onClick={() => rejecting[r.refund_request_id] ? update(r,'rejected') : setRejecting(current => ({ ...current, [r.refund_request_id]: true }))} className="rounded-lg border border-red-500/25 px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-50">{rejecting[r.refund_request_id] ? 'Confirm rejection' : 'Mark rejected'}</button>
              <button type="button" disabled={busy} onClick={() => update(r,'processing')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--text-dark)] transition hover:bg-[var(--gold-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:opacity-60">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}Mark Processing</button>
            </div>
          </div>}
          {r.status === 'processing' && <fieldset disabled={busy} className="min-w-0 border-t border-[var(--border)] pt-4">
            <legend className="sr-only">Review refund request</legend>
            <h4 className="text-sm font-semibold">Review &amp; action</h4>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Review the payment and destination, then upload a refund proof image or enter the transfer reference to complete the refund.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={`${labelClass} min-w-0 sm:col-span-2`}>Refund transaction reference<input maxLength={255} placeholder="Enter transfer reference" className={inputClass} value={draft[r.refund_request_id]?.refund_reference || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],refund_reference:e.target.value}})} /></label>
              <p className="text-xs text-[var(--text-muted)] sm:col-span-2">A transaction reference is required only when no refund proof image is provided.</p>
              <RefundProofUpload file={proofFiles[r.refund_request_id]} savedUrl={draft[r.refund_request_id]?.proof_url || r.proof_url} onError={setError} onChange={file => {
                setProofFiles(current => ({ ...current, [r.refund_request_id]: file }))
                setDraft(current => ({ ...current, [r.refund_request_id]: { ...current[r.refund_request_id], proof_url: undefined } }))
              }} />
              <label className={`${labelClass} sm:col-span-2`}>Admin notes / rejection reason<textarea rows={3} maxLength={2000} placeholder="Add review notes or explain why the request is rejected" className={`${inputClass} resize-y`} value={draft[r.refund_request_id]?.admin_notes || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],admin_notes:e.target.value}})} /></label>
            </div>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}
            {busy && <p role="status" className="mt-4 text-xs text-[var(--text-muted)]">{saveStage}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} onClick={() => update(r,'rejected')} className="rounded-lg border border-red-500/25 px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-50">Mark rejected</button>
              <button type="button" disabled={busy} onClick={() => update(r,'refunded')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--text-dark)] transition hover:bg-[var(--gold-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:cursor-wait disabled:opacity-60">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}Mark Refund Completed</button>
            </div>
          </fieldset>}
        </div>
      </article>)}
    </div>
  </section>
}
