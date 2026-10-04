import { CheckCircle, Edit, Archive, RotateCcw } from 'lucide-react'

const statusClasses = {
  not_started: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  on_hold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  completed: 'bg-green-500/10 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-300 border-red-500/30',
}

export function ProjectsTable({ projects, archived = false, isAdmin, openModal, deleteProject, restoreProject, footer }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] shadow-sm">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-4">
        <h3 className="text-sm font-semibold text-white">{archived ? 'Archived Projects' : 'Active Projects'}</h3>
        
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <caption className="sr-only">{archived ? 'Archived' : 'Active'} projects with progress, assignment and actions</caption>
          <thead className="border-b border-[var(--border)] bg-[var(--bg-primary)] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <tr>
              {['Project / Order #', 'Customer', 'Claimed By', 'Status', 'Progress', 'Estimated Completion', 'Notes', 'Actions'].map((label) => (
                <th key={label} scope="col" className="px-4 py-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/50">
            {projects.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">No projects match your filters.</td></tr>}
            {projects.map((project) => {
              const name = project.name || project.title || 'Untitled Project'
              const status = String(project.status || 'not_started').toLowerCase()
              const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0
              const notes = project.description || project.notes || 'No project notes yet.'
              return (
                <tr key={project.project_id} className="transition-colors hover:bg-[var(--bg-primary)]/40">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => openModal('project_tasks', project)} className="text-left font-semibold text-[var(--gold-primary)] hover:underline">{name}</button>
                    <p className="mt-1 text-[var(--text-muted)]">{project.order_number || project.custom_build_id || 'No order number'}</p>
                  </td>
                  <td className="px-4 py-3 text-white">{project.customer_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-white">{project.claimed_first_name ? [project.claimed_first_name, project.claimed_last_name].filter(Boolean).join(' ') : 'Unassigned'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-semibold capitalize ${statusClasses[status] || statusClasses.not_started}`}>{status.replace(/_/g, ' ')}</span>
                    {status === 'on_hold' && project.hold_reason && <p className="mt-2 max-w-48 text-amber-300/80">Hold reason: {project.hold_reason}</p>}
                    {project.cancel_requested_at && !project.cancel_approved_at && status !== 'cancelled' && <p className="mt-2 text-amber-300">Cancellation Requested</p>}
                  </td>
                  <td className="min-w-32 px-4 py-3">
                    <span className="font-semibold text-white">{progress}%</span>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-primary)]" role="progressbar" aria-label={`${name} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]" style={{ width: `${progress}%` }} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white">{project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'Not set'}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]"><p className="min-w-36 max-w-60 line-clamp-2" title={notes}>{notes}</p></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openModal('project_tasks', project)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--gold-primary)] px-3 py-2 font-semibold text-black transition-all hover:opacity-90"><CheckCircle className="h-3.5 w-3.5" />Manage Tasks</button>
                      {isAdmin && !archived && <>
                        <button type="button" onClick={() => openModal('project', project)} title="Edit project" aria-label={`Edit ${name}`} className="rounded-lg border border-[var(--border)] p-2 text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"><Edit className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteProject(project.project_id, name)} title="Archive project" aria-label={`Archive ${name}`} className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"><Archive className="h-4 w-4" /></button>
                      </>}
                      {isAdmin && archived && <button type="button" onClick={() => restoreProject(project.project_id, name)} title="Restore project" aria-label={`Restore ${name}`} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300 hover:bg-emerald-500/20"><RotateCcw className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
