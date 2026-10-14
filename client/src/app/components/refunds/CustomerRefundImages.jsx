import { useRef, useState } from 'react'
import { ImagePlus, ImageIcon, X } from 'lucide-react'

export default function CustomerRefundImages({ images, onChange, disabled, onBusyChange, error, label = 'Supporting images' }) {
  const lock = useRef(false)
  const [fileError, setFileError] = useState('')
  async function choose(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (lock.current || !files.length) return
    setFileError('')
    if (files.length + images.length > 5) { setFileError('Upload up to five images. Remove an image before replacing it.'); return }
    if (files.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size === 0 || f.size > 5 * 1024 * 1024)) {
      setFileError('Choose JPG, JPEG, PNG or WebP images up to 5 MB each.'); return
    }
    lock.current = true; onBusyChange?.(true)
    try {
      const values = []
      for (const file of files) {
        const value = await new Promise((resolve,reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Could not read this image. Please choose it again.'))
          reader.readAsDataURL(file)
        })
        await new Promise((resolve,reject) => {
          const preview = new Image()
          preview.onload = resolve
          preview.onerror = () => reject(new Error('The selected file is not a valid image.'))
          preview.src = value
        })
        values.push(value)
      }
      onChange([...images,...values])
    } catch (err) { setFileError(err.message) }
    finally { lock.current = false; onBusyChange?.(false) }
  }
  return <div className="space-y-3">
    <label className="block rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-light)]">
      <span className="flex items-center gap-2 font-semibold"><ImagePlus className="h-5 w-5 text-[var(--gold-primary)]" aria-hidden="true" />{label} <span style={{ color: '#ef4444' }}>*</span></span>
      <span className="mt-1 block text-xs text-[var(--text-muted)]">Choose clear photos from your device.</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={choose} className="mt-3 block w-full min-w-0 text-xs text-[var(--text-muted)] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--gold-primary)] file:px-3 file:py-2 file:font-semibold file:text-black disabled:opacity-50" />
    </label>
    <p className="text-xs text-[var(--text-muted)]">At least one image. Up to five JPG, JPEG, PNG or WebP images, 5 MB each. Remove an image to replace it.</p>
    <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]" aria-live="polite"><ImageIcon className="h-4 w-4" aria-hidden="true" />{images.length} / 5 photos selected</p>
    {images.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((src,index) => <div key={index} className="space-y-2 rounded-lg border border-[var(--border)] p-2">
      <img src={src} alt={`Supporting image ${index + 1}`} className="h-24 w-full rounded-lg bg-[var(--bg-primary)] object-contain" />
      <button type="button" disabled={disabled} onClick={() => onChange(images.filter((_,i) => i !== index))} className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"><X className="h-3 w-3" aria-hidden="true" />Remove image {index + 1}</button>
    </div>)}</div>}
    {(fileError || error) && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{fileError || error}</p>}
  </div>
}
