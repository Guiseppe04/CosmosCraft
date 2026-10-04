import { useEffect, useState } from 'react'
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
function RefundQrCode({ url }) {
  return <a href={url} target="_blank" rel="noreferrer" className="block my-3 w-fit">
    <img src={url} alt="Refund destination QR code" className="w-48 h-48 object-contain rounded-lg bg-white p-2" />
    <span className="text-[var(--gold-primary)]">View refund QR code</span>
  </a>
}
export default function AppointmentRefund({ apt }) {
  const [refund, setRefund] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ refund_method: apt.payment_method || '', destination_type: 'account', account_holder: '', account_number: '', reason: '' })
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
  return <div className="mt-4 p-4 border border-[var(--border)] rounded-xl text-sm text-white">
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {refund ? <><p>{labels[refund.status]}</p><p>Amount: {formatCurrency(refund.amount_requested)}</p>{refund.qr_code_url && <RefundQrCode url={refund.qr_code_url} />}{refund.refund_reference && <p>Refund reference: {refund.refund_reference}</p>}{refund.admin_notes && <p>{refund.admin_notes}</p>}{refund.proof_url && <a href={refund.proof_url} target="_blank" rel="noreferrer">View refund proof</a>}</> : eligible && loaded ? <>
      <button type="button" disabled={busy} onClick={() => setOpen(!open)} className="text-[var(--gold-primary)]">Request Refund</button>
      {open && <form onSubmit={handleSubmit}>
        <p className="my-3">Original approved payment: {formatPaymentMethod(apt.payment_method)} &middot; {formatCurrency(apt.approved_payment_amount)} &middot; Appointment {apt.reference_code}</p>
        {apt.payment_proof_url && <a href={apt.payment_proof_url} target="_blank" rel="noreferrer">View original payment proof</a>}
        <p className="my-2">The admin will manually send your refund using the details below.</p>
        <fieldset disabled={busy}>
          <label className="block my-2">E-wallet / bank<input required maxLength={100} value={form.refund_method} onChange={e => setForm({ ...form, refund_method: e.target.value })} className="block w-full p-2 rounded bg-white/10" /></label>
          <label className="block my-2">Refund destination
            <select aria-label="Refund destination" value={form.destination_type} onChange={e => { setForm({ ...form, destination_type: e.target.value }); setQrFile(null); setQrUrl(''); setError('') }} className="block w-full p-2 rounded bg-[var(--bg-primary)]">
              <option value="account">Account number</option><option value="qr">QR code</option>
            </select>
          </label>
          {form.destination_type === 'qr' ? <>
            <label className="block my-2">Upload refund QR code<input type="file" accept="image/png,image/jpeg,image/webp" required onChange={handleQrFile} className="block w-full my-2" /></label>
            <p className="text-xs text-[var(--text-muted)]">PNG, JPG, or WebP, up to 5 MB.</p>
            {qrPreview && <img src={qrPreview} alt="Refund QR code preview" className="w-48 h-48 object-contain rounded-lg bg-white p-2 my-3" />}
          </> : [['account_holder', 'Account holder name'], ['account_number', 'Account number / registered mobile number']].map(([key, label]) => <label key={key} className="block my-2">{label}<input required maxLength={key === 'account_holder' ? 200 : 100} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="block w-full p-2 rounded bg-white/10" /></label>)}
          <label className="block my-2">Reason<input maxLength={2000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="block w-full p-2 rounded bg-white/10" /></label>
          <button disabled={busy} className="p-2 border rounded">{busy ? 'Submitting...' : 'Submit refund request'}</button>
        </fieldset>
      </form>}
    </> : <><button type="button" disabled className="text-[var(--gold-primary)] opacity-50 cursor-not-allowed">Request Refund</button><p className="mt-2 text-[var(--text-muted)]">{supportsRefund ? 'Refund requests require an approved payment with a confirmed amount.' : 'Refund requests are available only for e-wallet or bank payments.'}</p></>}
  </div>
}
export function AppointmentRefundAdmin() {
  const [rows,setRows] = useState([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [draft,setDraft] = useState({})
  const load = () => refundRequest('/refund-requests?limit=100').then(data => setRows(data.refund_requests || [])).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  const update = async (row,status) => { setBusy(true); setError(''); try { await refundRequest(`/refund-requests/${row.refund_request_id}`,{method:'PATCH',body:{...draft[row.refund_request_id],status}}); await load() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  return <section className="mb-6 p-5 border border-[var(--border)] rounded-xl text-white"><h2 className="text-xl font-bold">Appointment No-Show Refunds</h2><button onClick={load}>Refresh</button>{error && <p role="alert" className="text-red-400">{error}</p>}
    {rows.length === 0 && <p>No appointment refund requests.</p>}
    {rows.map(r => <div key={r.refund_request_id} className="p-4 my-3 border border-[var(--border)] rounded-lg">
      <p>{r.first_name} {r.last_name} {r.email}</p><p>{r.reference_code} {new Date(r.scheduled_at).toLocaleString()} {r.appointment_type}</p>
      <p>{labels[r.status]} {formatCurrency(r.amount_requested)}</p>
      <p>Original approved payment: {formatPaymentMethod(r.original_payment.payment_method)} &middot; {formatCurrency(r.original_payment.amount)}</p>
      {r.original_payment.payment_proof_url && <a href={r.original_payment.payment_proof_url} target="_blank" rel="noreferrer">Original payment proof</a>}
      <p>Refund destination: {formatPaymentMethod(r.refund_method)}</p>
      {r.qr_code_url ? <RefundQrCode url={r.qr_code_url} /> : <p>{r.account_holder} {r.account_number}</p>}
      <p>Reason: {r.reason || 'Customer no-show'}</p>
      {r.refund_reference && <p>Refund reference: {r.refund_reference}</p>}{r.admin_notes && <p>{r.admin_notes}</p>}{r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer">Completed refund proof</a>}
      {['pending','processing'].includes(r.status) && <>
        {[['refund_reference','Refund transaction reference'],['proof_url','Refund proof HTTPS link'],['admin_notes','Admin notes / rejection reason']].map(([key,label]) => <label key={key} className="block my-2">{label}<input maxLength={2000} className="block w-full p-2 bg-white/10 rounded" value={draft[r.refund_request_id]?.[key] || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],[key]:e.target.value}})} /></label>)}
        {(r.status === 'pending' ? ['processing','rejected'] : ['refunded','rejected']).map(status => <button disabled={busy} key={status} onClick={() => update(r,status)} className="p-2 mr-2 border rounded">Mark {status}</button>)}
      </>}
    </div>)}
  </section>
}
