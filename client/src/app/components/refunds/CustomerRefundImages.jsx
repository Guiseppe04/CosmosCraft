import { useRef, useState } from 'react'

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
    <label className="block text-sm text-[var(--text-light)]">{label} <span style={{ color: '#ef4444' }}>*</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={choose} className="mt-2 block w-full text-sm" />
    </label>
    <p className="text-xs text-[var(--text-muted)]">At least one image. Up to five JPG, JPEG, PNG or WebP images, 5 MB each. Remove an image to replace it.</p>
    <div className="flex flex-wrap gap-3">{images.map((src,index) => <div key={index} className="space-y-1">
      <img src={src} alt={`Supporting image ${index + 1}`} className="h-20 w-20 rounded-lg object-cover" />
      <button type="button" disabled={disabled} onClick={() => onChange(images.filter((_,i) => i !== index))} className="text-xs text-red-400">Remove image {index + 1}</button>
    </div>)}</div>
    {(fileError || error) && <p role="alert" style={{ color: '#ef4444' }} className="text-sm text-red-400">{fileError || error}</p>}
  </div>
}
