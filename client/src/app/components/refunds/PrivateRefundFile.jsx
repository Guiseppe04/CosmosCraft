import { useEffect, useState } from 'react'
import { adminApi } from '../../utils/adminApi'

export default function PrivateRefundFile({ refundId, kind, label }) {
  const [image, setImage] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setImage('')
    adminApi.getRefundFile(refundId, kind).then(result => { if (active) setImage(result.data.image) })
      .catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refundId, kind, retry])
  return <div className="space-y-2">
    <p className="text-sm font-semibold text-[var(--text-light)]">{label}</p>
    {loading && <p role="status" className="text-sm text-[var(--text-muted)]">Loading secure image…</p>}
    {error && <div role="alert" className="text-sm text-red-400">{error} <button type="button" onClick={() => setRetry(v => v + 1)} className="underline">Retry</button></div>}
    {image && <><img src={image} alt={label} className="max-h-64 max-w-full rounded-lg bg-white object-contain" />
      <a href={image} download={`refund-${refundId}-${kind}.${image.startsWith('data:image/jpeg') ? 'jpg' : image.startsWith('data:image/webp') ? 'webp' : 'png'}`}
        className="inline-block rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--gold-primary)]">Download {label.toLowerCase()}</a></>}
  </div>
}
