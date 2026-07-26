import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'

export function ProjectTeamModal({ modal, form, setForm, users, closeModal, isSaving, assignProjectTeam }) {
  if (!modal.data) return null

  return (
    <>
      <ModalHeader title="Assign Team" onClose={closeModal} />
      <div className="mt-6">
        <p className="text-[var(--text-muted)] text-sm mb-4">
          Select team members for: <span className="text-white font-medium">{modal.data.name || modal.data.title}</span>
        </p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {users.filter((u) => u.role !== 'customer').map((user) => (
            <label key={user.user_id} className="flex items-center gap-3 p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--gold-primary)]/50 transition-all">
              <input
                type="checkbox"
                checked={!!form.team_ids?.includes(user.user_id)}
                onChange={(e) => {
                  const current = form.team_ids || []
                  const updated = e.target.checked ? [...current, user.user_id] : current.filter((id) => id !== user.user_id)
                  setForm((f) => ({ ...f, team_ids: updated }))
                }}
                className="w-4 h-4"
              />
              <div>
                <p className="text-white text-sm font-medium">{user.first_name} {user.last_name}</p>
                <p className="text-[var(--text-muted)] text-xs capitalize">{user.role?.replace('_', ' ')}</p>
              </div>
            </label>
          ))}
          {users.filter((u) => u.role !== 'customer').length === 0 && (
            <p className="text-[var(--text-muted)] text-sm text-center py-4">No staff members available</p>
          )}
        </div>
      </div>
      <ModalFooter onCancel={closeModal} onSave={() => assignProjectTeam(modal.data.project_id, form.team_ids || [])} isSaving={isSaving} />
    </>
  )
}
