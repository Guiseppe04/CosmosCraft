import { motion } from 'motion/react'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'

export function CategoryModal({
  modal,
  form,
  setForm,
  formErrors,
  categoryTree,
  closeModal,
  validateAndSave,
  CATEGORY_RULES,
  isSaving,
  saveCategory,
  inputCls,
}) {
  const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
  const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
  const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
  const selErr = `${inputCls} border-l-4 border-l-red-500`
  const selOk = inputCls

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

        {/* Organization */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Organization</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Parent Category</label>
              <select value={form.parent_id || ''} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value || null }))} className={selOk}>
                <option value="">None</option>
                {categoryTree.map(parent => (
                  <optgroup key={parent.category_id} label={parent.name}>
                    {parent.category_id !== modal.data?.category_id && (
                      <option value={parent.category_id}>{parent.name}</option>
                    )}
                    {parent.children?.filter(child => child.category_id !== modal.data?.category_id).map(child => (
                      <option key={child.category_id} value={child.category_id}>{child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">Create subcategories by selecting a parent.</p>
            </div>
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
          </div>
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
