import { Plus } from 'lucide-react'

export function ImageUploadWidget({ label, imageUrl, previewUrl, isUploading, onUpload, hint }) {
  const displayUrl = previewUrl || imageUrl

  return (
    <div className="space-y-2">
      <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</label>
      <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-[var(--bg-primary)]/50 transition-colors">
        {displayUrl ? (
          <div className="relative group w-full h-48 flex items-center justify-center p-4 bg-black/20 rounded-lg">
            <img src={displayUrl} alt="Preview" className="max-w-full max-h-full object-contain drop-shadow-lg" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
              <span className="text-white text-sm">Click below to change</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 flex items-center justify-center flex-col gap-2">
            <div className="p-3 bg-[var(--gold-primary)]/10 rounded-full text-[var(--gold-primary)]"><Plus className="w-6 h-6" /></div>
            <p className="text-[var(--text-muted)] text-sm">No image selected</p>
          </div>
        )}
        <label className="mt-4 px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] hover:border-[var(--gold-primary)]/50 rounded-lg text-white font-medium cursor-pointer transition-colors w-full text-center">
          {isUploading ? 'Uploading...' : 'Select Image'}
          <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" disabled={isUploading} onChange={onUpload} />
        </label>
      </div>
      {hint ? <p className="text-xs text-[var(--text-muted)] text-center">{hint}</p> : null}
    </div>
  )
}

export default ImageUploadWidget
