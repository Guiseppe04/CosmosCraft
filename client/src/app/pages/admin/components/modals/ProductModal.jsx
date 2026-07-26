import { motion } from 'motion/react'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { ModalHeader } from '../shared/ModalHeader'
import { ImageUploadWidget } from '../shared/ImageUploadWidget'

export function ProductModal({
  modal,
  form,
  setForm,
  formErrors,
  wizardTab,
  setWizardTab,
  closeModal,
  isSaving,
  isUploading,
  saveProduct,
  handleImageUpload,
  categoryTree,
  formatCurrency,
  validateAndSave,
  showToast,
  productRules,
  labelCls,
  inputCls,
}) {
  const productStep1Complete = Boolean(String(form.name || '').trim() && String(form.category_id || '').trim())
  const sellingN = parseFloat(form.price)
  const productStep2Complete = Boolean(String(form.sku || '').trim() && !Number.isNaN(sellingN) && sellingN > 0)
  const productStep3Complete = Boolean(form.image_url || form.preview_url || form.image_file)
  const productTabs = [
    { id: 'basic', step: 1, label: 'Basic Info', done: productStep1Complete },
    { id: 'inventory', step: 2, label: 'Pricing & Stock', done: productStep2Complete },
    { id: 'media', step: 3, label: 'Media & Assets', done: productStep3Complete },
  ]
  const sellingPrice = parseFloat(form.price)
  const costPrice = parseFloat(form.cost_price) || 0
  const hasValidSelling = !Number.isNaN(sellingPrice)
  const profitAmount = hasValidSelling ? sellingPrice - costPrice : NaN
  const marginPct = hasValidSelling && sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : null
  const marginHealthy = marginPct != null && marginPct >= 20
  const marginWarn = marginPct != null && marginPct < 20
  const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
  const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
  const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
  const selErr = `${inputCls} border-l-4 border-l-red-500`
  const selOk = inputCls

  return (
    <>
      <div className="sticky top-0 z-20 -mx-8 px-8 pt-0 pb-4 mb-1 bg-[var(--surface-dark)] border-b border-[var(--border)]">
        <ModalHeader title={modal.data ? 'Edit Product' : 'New Product'} onClose={closeModal} />
        <div className="mt-5 flex w-full items-center">
          {productTabs.map((tab, idx) => (
            <div key={tab.id} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                onClick={() => setWizardTab(tab.id)}
                className="flex w-full min-w-0 flex-col items-center gap-2"
              >
                <div
                  className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    wizardTab === tab.id
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]'
                      : tab.done
                        ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-400'
                        : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)]'
                  }`}
                >
                  {tab.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : tab.step}
                </div>
                <span className={`text-center text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-xs ${wizardTab === tab.id ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {tab.label}
                </span>
              </button>
              {idx < productTabs.length - 1 && <div className="mx-1 h-0.5 min-w-[1rem] flex-1 shrink rounded-full bg-[var(--border)] sm:mx-2" aria-hidden />}
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-[350px]">
        {wizardTab === 'basic' && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Product Name *</label>
              <input
                value={form.name || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Classic Stratocaster"
                className={formErrors.name ? fieldErr : fieldOk}
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Product Description</label>
              <textarea
                rows={3}
                value={form.description || ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Write a compelling description..."
                className={fieldOk}
              />
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Shown on the product page and in search previews.</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                <div>
                  <label className={`${labelCls} ${formErrors.brand ? 'text-red-400' : ''}`}>Brand</label>
                  <input
                    value={form.brand || ''}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Fender, Gibson, Ibanez"
                    className={formErrors.brand ? fieldErr : fieldOk}
                  />
                  {formErrors.brand && <p className="mt-1 text-xs text-red-400">{formErrors.brand}</p>}
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Manufacturer or brand name for product identification.</p>
                </div>
                <div>
                  <label className={`${labelCls} ${formErrors.category_id ? 'text-red-400' : ''}`}>Category *</label>
                  <select
                    value={form.category_id || ''}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className={formErrors.category_id ? selErr : selOk}
                  >
                    <option value="">Select Category</option>
                    {categoryTree.map((parent) => (
                      <optgroup key={parent.category_id} label={parent.name}>
                        <option value={parent.category_id}>{parent.name} (All)</option>
                        {parent.children?.map((child) => (
                          <option key={child.category_id} value={child.category_id}>{child.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {formErrors.category_id && <p className="mt-1 text-xs text-red-400">{formErrors.category_id}</p>}
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Groups this product in the shop catalog.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-start pb-0.5 md:pb-1">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] focus:ring-offset-gray-900"
                />
                <label htmlFor="is_active" className="cursor-pointer font-medium text-white">
                  Active Product
                </label>
              </div>
              <p className="ml-8 mt-1 text-xs text-[var(--text-muted)]">When off, the product is hidden from the storefront.</p>
            </div>
          </motion.div>
        )}

        {wizardTab === 'inventory' && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.sku ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Stock Keeping Unit (SKU) *</label>
                <input
                  value={form.sku || ''}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. GTR-STR-001"
                  className={formErrors.sku ? fieldErr : fieldOk}
                />
                {formErrors.sku && <p className="mt-1 text-xs text-red-400">{formErrors.sku}</p>}
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Used for inventory tracking and order fulfillment.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const prefix = 'GTR'
                  const timestamp = Date.now().toString(36).toUpperCase()
                  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
                  setForm((f) => ({ ...f, sku: `${prefix}-${timestamp}-${random}` }))
                }}
                className="shrink-0 self-start rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] sm:mt-7"
              >
                Auto-generate
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pricing</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.price ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Selling Price (₱) *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="e.g. 50000"
                    className={formErrors.price ? fieldErr : fieldOk}
                  />
                  {formErrors.price && <p className="mt-1 text-xs text-red-400">{formErrors.price}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cost Price (₱)</label>
                  <input
                    type="number"
                    value={form.cost_price || ''}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                    placeholder="e.g. 30000"
                    className={fieldOk}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Your landed cost per unit (optional, for margin math).</p>
                </div>
              </div>
            </div>

            {form.price !== '' && form.price !== null && form.price !== undefined && (
              <div
                className={`rounded-xl border p-4 sm:p-5 ${
                  marginWarn
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : marginHealthy
                      ? 'border-emerald-500/35 bg-emerald-500/10'
                      : 'border-[var(--border)] bg-[var(--bg-primary)]/50'
                }`}
              >
                <p className="mb-3 text-sm font-semibold text-white">Profit preview</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Selling price</p>
                    <p className="mt-1 font-semibold text-white">{hasValidSelling ? formatCurrency(sellingPrice, false) : '—'}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cost price</p>
                    <p className="mt-1 font-semibold text-white">{formatCurrency(costPrice, false)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profit amount</p>
                    <p className={`mt-1 font-semibold ${Number.isNaN(profitAmount) ? 'text-[var(--text-muted)]' : profitAmount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {hasValidSelling && !Number.isNaN(profitAmount) ? formatCurrency(profitAmount, false) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Margin %</p>
                    <p className={`mt-1 font-semibold ${marginPct == null ? 'text-[var(--text-muted)]' : marginHealthy ? 'text-emerald-300' : 'text-amber-200'}`}>
                      {marginPct != null ? `${Math.round(marginPct)}%` : '—'}
                    </p>
                  </div>
                </div>
                {marginWarn && marginPct != null && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-200/90">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Margin is below 20%. Consider adjusting price or cost.
                  </p>
                )}
                {marginHealthy && marginPct != null && <p className="mt-3 text-xs text-emerald-300/90">Healthy margin at or above 20%.</p>}
              </div>
            )}

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stock levels</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Initial Stock Quantity</label>
                  <input
                    type="number"
                    value={form.stock ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder="0"
                    className={fieldOk}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">On-hand count when creating the product.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    value={form.low_stock_threshold ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                    placeholder="10"
                    className={fieldOk}
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">You&apos;ll be alerted when stock drops to this level.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {wizardTab === 'media' && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <motion.div
              whileHover={{
                boxShadow: '0 0 0 2px rgba(212, 175, 55, 0.22)',
                borderColor: 'rgba(212, 175, 55, 0.45)',
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)]/40 p-4 sm:p-5"
            >
              <ImageUploadWidget
                label="Primary Main Image"
                imageUrl={form.image_url}
                previewUrl={form.preview_url}
                isUploading={isUploading}
                onUpload={handleImageUpload}
                hint="High-quality transparent PNGs or JPGs work best for optimal catalog display."
              />
            </motion.div>
            {(form.image_file || form.preview_url || form.image_url) && (
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-white">
                    {form.image_file?.name || (form.image_url ? 'Current catalog image' : 'Selected image')}
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
          </motion.div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-dark)] -mx-8 -mb-8 rounded-b-2xl px-8 pb-8 pt-5">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setWizardTab(wizardTab === 'inventory' ? 'basic' : wizardTab === 'media' ? 'inventory' : 'basic')}
            className={`rounded-lg border border-[var(--border)] px-4 py-2 font-medium text-white hover:bg-[var(--bg-primary)] ${wizardTab === 'basic' ? 'invisible' : 'visible'}`}
          >
            Back
          </button>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={closeModal} className="px-4 py-2 font-medium text-[var(--text-muted)] transition-colors hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await validateAndSave(productRules, async () => {
                await saveProduct()
                setForm({})
                setWizardTab('basic')
                showToast('Product saved! Add another.')
              })()
            }}
            disabled={isSaving}
            className="rounded-lg border border-[var(--gold-primary)] px-4 py-2 font-medium text-[var(--gold-primary)] transition-colors hover:bg-[var(--gold-primary)]/10"
          >
            Save & Add Another
          </button>
          <button
            type="button"
            onClick={validateAndSave(productRules, saveProduct)}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-[var(--gold-primary)] px-6 py-2 font-semibold text-black shadow-lg shadow-[var(--gold-primary)]/20 transition-all hover:bg-[var(--gold-secondary)]"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Product'}
          </button>
        </div>
      </div>
    </>
  )
}
