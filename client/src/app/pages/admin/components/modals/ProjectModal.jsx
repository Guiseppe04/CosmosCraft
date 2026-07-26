import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'
import { FormField } from '../shared/FormField'

export function ProjectModal({ modal, form, setForm, formErrors, closeModal, isSaving, saveProject, labelCls, inputCls, validateAndSave, projectRules }) {
  return (
    <>
      <ModalHeader title={modal.data ? 'Edit Project' : 'New Project'} onClose={closeModal} />
      <div className="space-y-4 mt-6">
        <FormField label="Project Name *" value={form.name || form.title || ''} onChange={(v) => setForm((f) => ({ ...f, name: v, title: v }))} error={formErrors.name} />
        <FormField label="Description" value={form.description || form.notes || ''} onChange={(v) => setForm((f) => ({ ...f, description: v, notes: v }))} textarea />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status || 'not_started'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">Progress</p>
            <p className="mt-2 text-sm text-white">Calculated automatically from completed project tasks.</p>
          </div>
        </div>
        <FormField label="Estimated Completion" type="date" value={form.estimated_completion_date || form.end_date || ''} onChange={(v) => setForm((f) => ({ ...f, estimated_completion_date: v, end_date: v }))} />
      </div>
      <ModalFooter onCancel={closeModal} onSave={validateAndSave(projectRules, saveProject)} isSaving={isSaving} />
    </>
  )
}
