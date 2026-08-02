import { motion } from 'motion/react'
import { Info, Loader2, X } from 'lucide-react'
import { ImageUploadWidget } from '../shared/ImageUploadWidget'

export function PartModal({
  modal,
  form,
  setForm,
  formErrors,
  setFormErrors,
  closeModal,
  isSaving,
  savePart,
  validateAndSave,
  PART_RULES,
  BUILDER_CATEGORY_MAP,
  SLOT_TO_PART_CATEGORY,
  INVENTORY_PART_CATEGORY_LABELS,
  INVENTORY_PART_CATEGORY_OPTIONS,
  isUploading,
  handleImageUpload,
  formatCurrency,
  labelCls,
  inputCls,
  normalizeInventoryPartCategory,
  deriveInventoryPartCategory,
}) {
  const partFieldBase =
    'w-full min-h-[2.875rem] px-4 py-3 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors box-border border border-[var(--border)]'
  const partFieldOk = `${partFieldBase} focus:ring-[var(--gold-primary)]`
  const partFieldErr = `${partFieldBase} border-red-500/60 focus:ring-red-500`
  const partSelErr = `${inputCls} border-l-4 border-l-red-500`
  const partHint = (text, tone = 'muted') => (
    <p
      className={`mt-1.5 flex gap-2 text-xs leading-relaxed ${
        tone === 'gold' ? 'text-[var(--gold-primary)]/95' : 'text-[var(--text-muted)]'
      }`}
    >
      <Info
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone === 'gold' ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">{text}</span>
    </p>
  )
  const partTextareaOk =
    'w-full min-h-[5.5rem] resize-y px-4 py-3 box-border bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm transition-colors'
  const slotHints = {
    basePrice: 'Overrides the base starting price shown in customization pages.',
    body: 'Controls the guitar body shape and wood.',
    bodyWood: 'Controls body wood species and grain for the configurator.',
    bodyFinish: 'Controls finish color and treatment on the body.',
    pickguard: 'Sets pickguard style and material on the body.',
    neck: 'Controls neck profile and construction options.',
    fretboard: 'Sets the fretboard material and inlay style.',
    headstock: 'Controls headstock shape and branding placement.',
    headstockShape: 'Controls the headstock silhouette used in the builder.',
    headstockWood: 'Sets headstock wood and contrast details.',
    inlays: 'Controls fretboard inlay pattern and markers.',
    inlayShape: 'Sets the inlay shape (dots, diamonds, blocks).',
    inlayMaterial: 'Sets the inlay material (pearl, abalone, luminlay, etc.).',
    neckConstruction: 'Controls neck build style (1-piece, 3-piece, 5-piece).',
    frets: 'Controls fret wire size and material.',
    trussRodCover: 'Sets the truss rod cover style and material.',
    neckRearFinish: 'Controls the finish applied to the back of the neck.',
    hardware: 'Groups general hardware options on the build.',
    bridge: 'Controls bridge type, routing, and string anchoring.',
    knobs: 'Sets control knob style and layout.',
    saddle: 'Sets bridge saddle material and finish.',
    nut: 'Controls nut material and brand.',
    outputJack: 'Controls output jack style and material.',
    strapButtons: 'Controls strap button installation.',
    tunerButtons: 'Controls tuner button installation.',
    tremoloCover: 'Controls tremolo cavity cover style.',
    pickups: 'Determines pickup configuration and sound.',
    pickupConfiguration: 'Sets the pickup layout (SSS, HSS, HH, P90).',
    pickupBobbin: 'Controls pickup bobbin style (standard, painted, wooden).',
    pickupPoleColor: 'Sets pickup pole piece color.',
    bridgePickupModel: 'Selects the bridge pickup model.',
    middlePickupModel: 'Selects the middle pickup model.',
    neckPickupModel: 'Selects the neck pickup model.',
    electronicsType: 'Controls active vs passive electronics.',
    controls: 'Sets control layout (standard, tone delete, etc.).',
    electronicsCavityCover: 'Controls the electronics cavity cover style.',
  }
  const slotHint = form.type_mapping ? slotHints[form.type_mapping] : null
  const previewGuitarType = (form.guitar_type || 'electric').replace(/\b\w/g, (l) => l.toUpperCase())
  const previewPartCat = (form.part_category || form.type_mapping || 'misc').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  const previewInventoryCategory =
    INVENTORY_PART_CATEGORY_LABELS[
      normalizeInventoryPartCategory(form.inventory_category) || deriveInventoryPartCategory(form)
    ] || 'Accessories'
  const canSubmit = Boolean(
    String(form.name || '').trim() &&
    String(form.type_mapping || '').trim() &&
    normalizeInventoryPartCategory(form.inventory_category)
  )
  const previewPrice = form.price !== '' && form.price != null && !Number.isNaN(Number(form.price)) ? formatCurrency(Number(form.price), false) : '—'

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-white text-xl font-bold">{modal.data ? 'Edit Guitar Part' : 'Add Guitar Part'}</h2>
        <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--text-muted)]" />
        </button>
      </div>
      <div className="mt-0 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-0">
        <div className="min-w-0 space-y-5 md:pr-8">
          <div>
            <label className={`${labelCls} ${formErrors.name ? 'text-red-400' : ''}`}>Part Name *</label>
            <input
              value={form.name || ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mahogany Body"
              className={formErrors.name ? partFieldErr : partFieldOk}
            />
            {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
            {partHint('This label appears in the builder catalog and admin lists.')}
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={partTextareaOk}
            />
            {partHint('Optional notes for staff; not always shown to customers.')}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Builder placement</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Builder Category (Customize Page)</label>
                <select
                  value={form.builder_category || ''}
                  onChange={(e) => {
                    const builderCategory = e.target.value
                    const firstSlot = BUILDER_CATEGORY_MAP[builderCategory]?.[0] || ''
                    setForm((f) => ({
                      ...f,
                      builder_category: builderCategory,
                      type_mapping: firstSlot || f.type_mapping || '',
                      part_category: SLOT_TO_PART_CATEGORY[firstSlot] || f.part_category || 'misc',
                    }))
                  }}
                  className={inputCls}
                >
                  <option value="">Select Category</option>
                  <option value="pricing">Pricing</option>
                  <option value="body">Body</option>
                  <option value="neck">Neck & Headstock</option>
                  <option value="hardware">Hardware</option>
                  <option value="electronics">Electronics</option>
                </select>
                {partHint('High-level section in the customizer sidebar.')}
              </div>
              <div>
                <label className={`${labelCls} ${formErrors.type_mapping ? 'text-red-400' : ''}`}>Type Mapping (UI Slot) *</label>
                <select
                  value={form.type_mapping || ''}
                  onChange={(e) => {
                    const typeMapping = e.target.value
                    setForm((f) => ({
                      ...f,
                      type_mapping: typeMapping,
                      part_category: SLOT_TO_PART_CATEGORY[typeMapping] || f.part_category || 'misc',
                    }))
                  }}
                  className={formErrors.type_mapping ? partSelErr : inputCls}
                >
                  <option value="">Select Type</option>
                  {(form.builder_category ? BUILDER_CATEGORY_MAP[form.builder_category] || [] : Object.values(BUILDER_CATEGORY_MAP).flat()).map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/([A-Z])/g, ' ').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                {formErrors.type_mapping && <p className="mt-1 text-xs text-red-400">{formErrors.type_mapping}</p>}
                {slotHint ? partHint(slotHint, 'gold') : null}
                {partHint(
                  'Slots follow CustomizePage field names to keep admin parts aligned with builder logic.',
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Catalog metadata</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className={`${labelCls} ${formErrors.inventory_category ? 'text-red-400' : ''}`}>Category *</label>
                <select
                  value={
                    normalizeInventoryPartCategory(form.inventory_category) ||
                    (form.part_category || form.type_mapping || modal.data?.part_id
                      ? deriveInventoryPartCategory(form)
                      : '')
                  }
                  onChange={(e) => {
                    setForm((f) => ({ ...f, inventory_category: e.target.value }))
                    setFormErrors((prev) => ({ ...prev, inventory_category: null }))
                  }}
                  className={formErrors.inventory_category ? partSelErr : inputCls}
                >
                  <option value="">Select Category</option>
                  {INVENTORY_PART_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formErrors.inventory_category && <p className="mt-1 text-xs text-red-400">{formErrors.inventory_category}</p>}
                {partHint('Used by the Inventory tab for category filters and grouped display.')}
              </div>
              <div>
                <label className={labelCls}>Guitar Type</label>
                <select value={form.guitar_type || 'electric'} onChange={(e) => setForm((f) => ({ ...f, guitar_type: e.target.value }))} className={inputCls}>
                  {['electric', 'bass', 'ukulele'].map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                {partHint('Which instrument line this part belongs to.')}
              </div>
              <div>
                <label className={labelCls}>Technical Part Category</label>
                <select value={form.part_category || form.type_mapping || 'misc'} onChange={(e) => setForm((f) => ({ ...f, part_category: e.target.value }))} className={inputCls}>
                  {['body', 'neck', 'fretboard', 'pickups', 'bridge', 'electronics', 'hardware', 'tuners', 'strings', 'finish', 'wood_type', 'pickguard', 'misc'].map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                {partHint('Keeps the builder mapping intact for customization logic.')}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stock & pricing</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              <div>
                <label className={labelCls}>Qty in Stock</label>
                <input
                  type="number"
                  value={form.stock ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className={partFieldOk}
                />
                {partHint('How many units are available for builds.')}
              </div>
              <div>
                <label className={labelCls}>Upgrade Price (₱)</label>
                <input
                  type="number"
                  value={form.price || ''}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className={partFieldOk}
                />
                {partHint('Added cost when the customer selects this option.')}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/40 px-4 py-3.5">
            <input
              type="checkbox"
              id="is_active_part"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-gray-600 bg-[var(--surface-dark)] text-[var(--gold-primary)] accent-[var(--gold-primary)] focus:ring-2 focus:ring-[var(--gold-primary)] focus:ring-offset-0 focus:ring-offset-transparent"
            />
            <label htmlFor="is_active_part" className="cursor-pointer select-none text-sm leading-snug text-white">
              <span className="font-medium">Active</span>
              <span className="mt-0.5 block text-xs font-normal leading-relaxed text-[var(--text-muted)]">
                Available in the configurator when checked.
              </span>
            </label>
          </div>
        </div>
        <div className="min-w-0 border-[var(--border)] md:border-l md:pl-8">
          <div className="space-y-5">
            <motion.div
              whileHover={{
                boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.22)',
                borderColor: 'rgba(212, 175, 55, 0.45)',
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)]/40 p-4 sm:p-5"
            >
              <ImageUploadWidget
                label="Configurator Asset (Transparent PNG recommended)"
                imageUrl={form.image_url}
                previewUrl={form.preview_url}
                isUploading={isUploading}
                onUpload={handleImageUpload}
                hint="Configurator assets are dynamically composed on the frontend."
              />
            </motion.div>
            {(form.image_file || form.preview_url || form.image_url) && (
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-white">
                    {form.image_file?.name || (form.image_url ? 'Current configurator asset' : 'Selected image')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {form.image_file ? `${(form.image_file.size / 1024).toFixed(form.image_file.size >= 102400 ? 0 : 1)} KB` : form.image_url ? 'Replace below or remove to clear.' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      image_file: undefined,
                      preview_url: undefined,
                      image_url: '',
                    }))
                  }
                  className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                >
                  Remove image
                </button>
              </div>
            )}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/70 p-4 shadow-inner sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Catalog preview</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex h-20 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-black/25 sm:h-24 sm:w-28">
                  {form.preview_url || form.image_url ? (
                    <img src={form.preview_url || form.image_url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="px-2 text-center text-[10px] text-[var(--text-muted)]">No image yet</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-base font-semibold text-white">{form.name?.trim() || 'Part name'}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-primary)]">
                      {previewInventoryCategory}
                    </span>
                    <span className="rounded-md border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gold-primary)]">
                      {previewGuitarType}
                    </span>
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-dark)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {previewPartCat}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        form.is_active ?? true ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border border-[var(--border)] bg-black/20 text-[var(--text-muted)]'
                      }`}
                    >
                      {form.is_active ?? true ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Upgrade: <span className="font-semibold text-[var(--gold-primary)]">{previewPrice}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3 border-t border-[var(--border)] pt-4">
        <button
          onClick={closeModal}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl bg-[var(--bg-primary)] text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={validateAndSave(PART_RULES, savePart)}
          disabled={!canSubmit || isSaving}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isSaving ? 'Saving...' : modal.data ? 'Update Guitar Part' : 'Save Guitar Part'}
        </button>
      </div>
    </>
  )
}
