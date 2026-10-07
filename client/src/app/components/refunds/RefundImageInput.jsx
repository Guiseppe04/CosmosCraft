import { useState } from 'react'

export default function RefundImageInput({ label, value, onChange, disabled, onBusyChange }) {
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
    <label className="block text-sm font-medium text-[var(--text-light)]">{label}
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={choose}
        className="mt-2 block w-full text-sm text-[var(--text-muted)]" />
    </label>
    <p className="text-xs text-[var(--text-muted)]">PNG, JPG, JPEG or WebP. Maximum 5 MB. {busy ? 'Reading image…' : ''}</p>
    {value && <div className="space-y-2"><img src={value} alt={label} className="max-h-48 max-w-full rounded-lg bg-white object-contain" />
      <button type="button" disabled={disabled || busy} onClick={() => onChange(undefined)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-light)]">Remove image</button></div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>
}
