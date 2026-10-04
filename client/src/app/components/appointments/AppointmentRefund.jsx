import { useEffect, useState } from 'react'
import { API, getAuthHeaders } from '../../utils/apiConfig'
export async function refundRequest(path, options = {}) {
  const response = await fetch(`${API}/api/appointments${path}`, { credentials: 'include', ...options,
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: options.body ? JSON.stringify(options.body) : undefined })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Refund request failed')
  return result.data
}
const labels = { pending: 'Refund Requested', processing: 'Refund Processing', refunded: 'Refunded', rejected: 'Refund Rejected' }
export default function AppointmentRefund({ apt }) {
  const [refund, setRefund] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ refund_method: apt.payment_method || '', account_holder: '', account_number: '', reason: '' })
  useEffect(() => {
    let live = true
    setLoaded(false)
    refundRequest(`/${apt.appointment_id}/refund-requests`).then(data => { if (live) { setRefund(data.refund_requests?.[0] || null); setLoaded(true) } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [apt.appointment_id, apt.payment_status])
  if (!['no_show', 'cancelled'].includes(String(apt.status || '').toLowerCase())) return null
  const eligible = apt.payment_status === 'approved' && Number(apt.approved_payment_amount) > 0
  return <div className="mt-4 p-4 border border-[var(--border)] rounded-xl text-sm text-white">
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {refund ? <><p>{labels[refund.status]}</p><p>Amount: ?{Number(refund.amount_requested).toFixed(2)}</p>{refund.refund_reference && <p>Refund reference: {refund.refund_reference}</p>}{refund.admin_notes && <p>{refund.admin_notes}</p>}{refund.proof_url && <a href={refund.proof_url} target="_blank" rel="noreferrer">View refund proof</a>}</> : eligible && loaded ? <>
      <button type="button" onClick={() => setOpen(!open)} className="text-[var(--gold-primary)]">Request Refund</button>
      {open && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { const data = await refundRequest('/refund-requests', { method:'POST', body: { ...form, appointment_id:apt.appointment_id } }); setRefund(data.refund_request); setOpen(false) } catch(e) { setError(e.message) } finally { setBusy(false) } }}>
        <p className="my-3">Original approved payment: {apt.payment_method} ? ?{Number(apt.approved_payment_amount).toFixed(2)} ? Appointment {apt.reference_code}</p>
        {apt.payment_proof_url && <a href={apt.payment_proof_url} target="_blank" rel="noreferrer">View original payment proof</a>}
        <p className="my-2">The admin will manually send your refund to the account below.</p>
        {[['refund_method','E-wallet / bank'],['account_holder','Account holder name'],['account_number','Account number / registered mobile number'],['reason','Reason']].map(([key,label]) => <label key={key} className="block my-2">{label}<input required={key !== 'reason'} maxLength={key === 'reason' ? 2000 : key === 'account_holder' ? 200 : 100} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} className="block w-full p-2 rounded bg-white/10" /></label>)}
        <button disabled={busy} className="p-2 border rounded">{busy ? 'Submitting?' : 'Submit refund request'}</button>
      </form>}
    </> : <><button type="button" disabled className="text-[var(--gold-primary)] opacity-50 cursor-not-allowed">Request Refund</button><p className="mt-2 text-[var(--text-muted)]">Refund requests require an approved payment with a confirmed amount.</p></>}
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
      <p>{labels[r.status]} {Number(r.amount_requested).toFixed(2)}</p>
      <p>Original approved payment: {r.original_payment.payment_method} {r.original_payment.amount}</p>
      {r.original_payment.payment_proof_url && <a href={r.original_payment.payment_proof_url} target="_blank" rel="noreferrer">Original payment proof</a>}
      <p>Refund destination: {r.refund_method}  {r.account_holder}  {r.account_number}</p><p>Reason: {r.reason || 'Customer no-show'}</p>
      {r.refund_reference && <p>Refund reference: {r.refund_reference}</p>}{r.admin_notes && <p>{r.admin_notes}</p>}{r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer">Completed refund proof</a>}
      {['pending','processing'].includes(r.status) && <>
        {[['refund_reference','Refund transaction reference'],['proof_url','Refund proof HTTPS link'],['admin_notes','Admin notes / rejection reason']].map(([key,label]) => <label key={key} className="block my-2">{label}<input maxLength={2000} className="block w-full p-2 bg-white/10 rounded" value={draft[r.refund_request_id]?.[key] || ''} onChange={e => setDraft({...draft,[r.refund_request_id]:{...draft[r.refund_request_id],[key]:e.target.value}})} /></label>)}
        {(r.status === 'pending' ? ['processing','rejected'] : ['refunded','rejected']).map(status => <button disabled={busy} key={status} onClick={() => update(r,status)} className="p-2 mr-2 border rounded">Mark {status}</button>)}
      </>}
    </div>)}
  </section>
}
