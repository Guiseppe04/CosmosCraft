import { motion } from 'motion/react'
import { Search, Settings, Briefcase, CheckCircle, Edit, Trash2, X } from 'lucide-react'
import { EmptyState } from '../components/shared/EmptyState'
import DefaultWorkflowEditor from '../../../components/projects/DefaultWorkflowEditor'

export function ProjectsTab({
  visibleProjects,
  projects,
  users,
  searchQuery,
  setSearchQuery,
  projectStatusFilter,
  setProjectStatusFilter,
  projectAssignedFilter,
  setProjectAssignedFilter,
  projectSort,
  setProjectSort,
  projectGuitarTypeFilter,
  setProjectGuitarTypeFilter,
  projectDateFrom,
  setProjectDateFrom,
  projectDateTo,
  setProjectDateTo,
  projectDueDateFrom,
  setProjectDueDateFrom,
  projectDueDateTo,
  projectCompletionFilter,
  setProjectCompletionFilter,
  setProjectPage,
  openModal,
  isSuperAdmin,
  showDefaultWorkflowEditor,
  setShowDefaultWorkflowEditor,
  deleteProject,
  debouncedSearch,
}) {
  return (
    <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-white text-xl font-semibold">Projects</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Open a project to manage milestones and subtasks for the build.
            </p>
            {isSuperAdmin && (
              <button
                onClick={() => setShowDefaultWorkflowEditor(true)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm font-semibold text-white transition-all hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
              >
                <Settings className="w-4 h-4" />
                Edit Default Tasks
              </button>
            )}
            <DefaultWorkflowEditor
              isOpen={showDefaultWorkflowEditor}
              onClose={() => setShowDefaultWorkflowEditor(false)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">Total</p>
              <p className="text-white text-lg font-semibold">{visibleProjects.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">In Progress</p>
              <p className="text-white text-lg font-semibold">{visibleProjects.filter((project) => project.status === 'in_progress').length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">Completed</p>
              <p className="text-white text-lg font-semibold">{visibleProjects.filter((project) => project.status === 'completed').length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value) }}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <select
          value={projectStatusFilter}
          onChange={(e) => { setProjectStatusFilter(e.target.value) }}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
        >
          <option value="all">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={projectAssignedFilter}
          onChange={(e) => { setProjectAssignedFilter(e.target.value) }}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
        >
          <option value="all">All Assigned Staff</option>
          {(users || [])
            .filter((u) => ['staff', 'admin', 'super_admin'].includes(u.role))
            .map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
        </select>
        <select
          value={projectSort}
          onChange={(e) => { setProjectSort(e.target.value) }}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
        >
          <option value="updated">Recently Updated</option>
          <option value="created">Recently Created</option>
          <option value="name">Project Name</option>
          <option value="customer">Customer Name</option>
          <option value="progress">Progress</option>
          <option value="due">Due Date</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={projectGuitarTypeFilter}
          onChange={(e) => { setProjectGuitarTypeFilter(e.target.value) }}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
        >
          <option value="all">All Guitar Types</option>
          <option value="Electric">Electric</option>
          <option value="Acoustic">Acoustic</option>
          <option value="Bass">Bass</option>
          <option value="Classical">Classical</option>
        </select>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">Date From</label>
          <input
            type="date"
            value={projectDateFrom}
            onChange={(e) => { setProjectDateFrom(e.target.value) }}
            className="w-full px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">Date To</label>
          <input
            type="date"
            value={projectDateTo}
            onChange={(e) => { setProjectDateTo(e.target.value) }}
            className="w-full px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <button
          onClick={() => {
            setProjectStatusFilter('all')
            setProjectAssignedFilter('all')
            setProjectGuitarTypeFilter('all')
            setProjectDateFrom('')
            setProjectDateTo('')
            setProjectDueDateFrom('')
            setProjectDueDateTo('')
            setProjectCompletionFilter('all')
            setProjectSort('updated')
            setProjectPage(1)
          }}
          className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 text-sm font-medium hover:bg-red-500/20 transition-colors w-full justify-center"
        >
          <X className="w-3 h-3" /> Clear Filters
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">Due Date From</label>
          <input
            type="date"
            value={projectDueDateFrom}
            onChange={(e) => { setProjectDueDateFrom(e.target.value) }}
            className="w-full px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">Due Date To</label>
          <input
            type="date"
            value={projectDueDateTo}
            onChange={(e) => { setProjectDueDateTo(e.target.value) }}
            className="w-full px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <select
          value={projectCompletionFilter}
          onChange={(e) => { setProjectCompletionFilter(e.target.value) }}
          className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
        >
          <option value="all">All Completion %</option>
          <option value="0">0%</option>
          <option value="25">25%</option>
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
        </select>
      </div>

      {(projectStatusFilter !== 'all' || projectAssignedFilter !== 'all' || projectGuitarTypeFilter !== 'all' || projectDateFrom || projectDateTo || projectDueDateFrom || projectDueDateTo || projectCompletionFilter !== 'all') && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-xs text-[var(--text-muted)]">Active filters:</span>
          {projectStatusFilter !== 'all' && (
            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-lg border border-blue-500/30">Status: {projectStatusFilter}</span>
          )}
          {projectGuitarTypeFilter !== 'all' && (
            <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-lg border border-purple-500/30">Guitar: {projectGuitarTypeFilter}</span>
          )}
          {projectCompletionFilter !== 'all' && (
            <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-lg border border-green-500/30">Progress: {projectCompletionFilter}%</span>
          )}
          {projectDateFrom && (
            <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-lg border border-amber-500/30">From: {projectDateFrom}</span>
          )}
          {projectDateTo && (
            <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-lg border border-amber-500/30">To: {projectDateTo}</span>
          )}
          {projectDueDateFrom && (
            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs rounded-lg border border-indigo-500/30">Due From: {projectDueDateFrom}</span>
          )}
          {projectDueDateTo && (
            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-xs rounded-lg border border-indigo-500/30">Due To: {projectDueDateTo}</span>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          label={debouncedSearch ? 'No projects match your search' : 'No projects found'}
          action={isSuperAdmin ? () => openModal('project') : undefined}
          actionLabel="Create Project"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {visibleProjects.map((project) => {
            const status = String(project.status || 'not_started').toLowerCase()
            const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0
            const statusClass = {
              not_started: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
              in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
              completed: 'bg-green-500/10 text-green-300 border-green-500/30',
            }[status] || 'bg-slate-500/10 text-slate-300 border-slate-500/30'

            return (
              <div key={project.project_id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[var(--gold-primary)] text-xs font-semibold uppercase tracking-[0.25em]">
                      {project.order_number || 'Project'}
                    </p>
                    <h3 className="mt-2 truncate text-xl font-semibold text-white">
                      {project.name || project.title || 'Untitled Project'}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      Customer: <span className="text-white">{project.customer_name || 'Unassigned'}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Progress</span>
                    <span className="text-sm font-semibold text-white">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-dark)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Estimated completion</p>
                    <p className="mt-2 font-medium text-white">
                      {project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Notes</p>
                    <p className="mt-2 line-clamp-2 text-sm text-white">
                      {project.description || project.notes || 'No project notes yet.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openModal('project_tasks', project)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Manage Tasks
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => openModal('project', project)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteProject(project.project_id, project.name || project.title || 'Project')}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Archive
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
