import { useState } from 'react'
import { Camera, CheckCircle2, UploadCloud } from 'lucide-react'

export default function RefundImageInput({ label, value, onChange, disabled, onBusyChange, presentation = 'default' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG, JPG, JPEG or WebP image up to 5 MB.')
      return
    }
    setBusy(true); onBusyChange?.(true)
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('The image could not be read.'))
        reader.readAsDataURL(file)
      })
      await new Promise((resolve, reject) => {
        const preview = new Image()
        preview.onload = resolve
        preview.onerror = () => reject(new Error('The file is not a valid image.'))
        preview.src = image
      })
      onChange(image)
    } catch (err) { setError(err.message) }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  return <div className="space-y-2">
    {presentation === 'dropzone' ? <>
      <p className="text-sm font-semibold text-[var(--text-light)]">{label}</p>
      <label className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)] px-5 py-6 text-center transition-colors hover:border-[var(--gold-primary)] focus-within:border-[var(--gold-primary)] focus-within:ring-2 focus-within:ring-[var(--gold-primary)] ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}>
        <input aria-label={label} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={choose} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--gold-primary)]"><UploadCloud className="h-5 w-5" aria-hidden="true" /></span>
        <span className="text-sm font-semibold text-[var(--text-light)]">{busy ? 'Reading photo…' : value ? 'Choose a different photo' : 'Click to upload a condition photo'}</span>
        <span className="text-xs leading-relaxed text-[var(--text-muted)]">Show the item clearly, including its surface and packaging.</span>
        <span className="text-[11px] font-medium text-[var(--text-muted)]">PNG, JPG or WebP · Up to 5 MB</span>
      </label>
    </> : <><label className="block text-sm font-medium text-[var(--text-light)]">{label}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={choose}
        className="mt-2 block w-full text-sm text-[var(--text-muted)]" />
    </label>
    <p className="text-xs text-[var(--text-muted)]">PNG, JPG, JPEG or WebP. Maximum 5 MB. {busy ? 'Reading image…' : ''}</p></>}
    {value && <div className={presentation === 'dropzone' ? 'space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-3' : 'space-y-2'}>
      {presentation === 'dropzone' && <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Photo attached<Camera className="ml-auto h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /></p>}
      <img src={value} alt={label} className="max-h-48 max-w-full rounded-lg bg-white object-contain" />
      <button type="button" disabled={disabled || busy} onClick={() => onChange(undefined)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-light)]">Remove image</button></div>}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{error}</p>}
  </div>
}
