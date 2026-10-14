import { useEffect, useState } from 'react'
import { adminApi } from '../../utils/adminApi'
import ImageZoomModal from '../../pages/admin/components/shared/ImageZoomModal'
import { Download } from 'lucide-react'

export default function PrivateRefundFile({ refundId, kind, label }) {
  const [image, setImage] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [createdAt, setCreatedAt] = useState(null), [zoom, setZoom] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setImage(''); setCreatedAt(null); setZoom(false)
    adminApi.getRefundFile(refundId, kind).then(result => { if (active) {setImage(result.data.image);setCreatedAt(result.data.created_at || null)} })
      .catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refundId, kind, retry])
  return <div className="space-y-2">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold text-[var(--text-light)]">{label}</p>
      {image && <a href={image} download={`refund-${refundId}-${kind}.${image.startsWith('data:image/jpeg') ? 'jpg' : image.startsWith('data:image/webp') ? 'webp' : 'png'}`}
        aria-label={`Download ${label.toLowerCase()}`} title={`Download ${label.toLowerCase()}`} className="rounded-lg p-1 text-[var(--gold-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)]"><Download className="h-4 w-4" aria-hidden="true" /></a>}
    </div>
    {createdAt && /^(evidence|return)_?[0-4]$/.test(kind) && <p className="text-xs text-[var(--text-muted)]">Uploaded: <time dateTime={createdAt}>{new Date(createdAt).toLocaleString('en-PH', {timeZone:'Asia/Manila'})}</time></p>}
    {loading && <p role="status" className="text-sm text-[var(--text-muted)]">Loading secure image…</p>}
    {error && <div role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error} <button type="button" onClick={() => setRetry(v => v + 1)} className="underline">Retry</button></div>}
    {image && <button type="button" onClick={() => setZoom(true)} aria-label={`Enlarge ${label.toLowerCase()}`} className="block max-w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold-primary)]"><img src={image} alt={label} className="max-h-64 max-w-full rounded-lg bg-white object-contain" /></button>}
    {zoom && <ImageZoomModal isOpen src={image} alt={label} onClose={() => setZoom(false)} />}
  </div>
}
