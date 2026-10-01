import { motion } from 'motion/react'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'

export function CategoryModal({
  modal,
  form,
  setForm,
  formErrors,
  closeModal,
  validateAndSave,
  CATEGORY_RULES,
  isSaving,
  saveCategory,
}) {
  const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
  const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
  const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
  return (
    <>
      <ModalHeader title={modal.data ? 'Edit Category' : 'New Category'} onClose={closeModal} />
      <div className="space-y-5 mt-6">
        {/* Basic Information */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Category Name *</label>
            <input
              value={form.name || ''}
              onChange={(e) => {
                setForm(f => ({ ...f, name: e.target.value }))
              }}
              placeholder="e.g. Custom Builds, Acoustic Guitars"
              className={formErrors.name ? fieldErr : fieldOk}
            />
            {formErrors.name && <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>}
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">The display name for this category.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Description</label>
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Write a brief description for this category..."
              className={fieldOk}
            />
          </div>
        </motion.div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Sort Order</label>
          <input
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
            placeholder="0"
            className={fieldOk}
          />
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">Controls display order. Lower numbers appear first.</p>
        </div>

        {/* Status */}
        <div className="flex flex-col justify-start pb-0.5 md:pb-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="category_is_active"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-5 w-5 rounded border-gray-600 bg-gray-800 text-[var(--gold-primary)] focus:ring-[var(--gold-primary)] focus:ring-offset-gray-900"
            />
            <label htmlFor="category_is_active" className="cursor-pointer font-medium text-white">
              Active Category
            </label>
          </div>
          <p className="ml-8 mt-1 text-xs text-[var(--text-muted)]">When unchecked, this category will be hidden from the storefront.</p>
        </div>
      </div>
      <ModalFooter onCancel={closeModal} onSave={validateAndSave(CATEGORY_RULES, saveCategory)} isSaving={isSaving} />
    </>
  )
}
