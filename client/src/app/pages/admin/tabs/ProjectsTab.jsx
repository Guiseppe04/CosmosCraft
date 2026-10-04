import { useState } from 'react'
import { motion } from 'motion/react'
import { Search, Settings, Briefcase, CheckCircle, Edit, Trash2, RotateCcw, Archive, Plus, Filter, ChevronDown, Table2, LayoutGrid } from 'lucide-react'
import { EmptyState } from '../components/shared/EmptyState'
import DefaultWorkflowEditor from '../../../components/projects/DefaultWorkflowEditor'
import { PaginationBar } from '../components/shared/PaginationBar'
import { ProjectsTable } from '../components/projects/ProjectsTable'

export function ProjectsTab({
  visibleProjects,
  visibleArchivedProjects,
  projects,
  archivedProjects,
  users,
  searchQuery,
  setSearchQuery,
  projectStatusFilter,
  setProjectStatusFilter,
  projectAssignedFilter,
  setProjectAssignedFilter,
  projectSort,
  setProjectSort,
  projectSortDirection,
  setProjectSortDirection,
  projectGuitarTypeFilter,
  setProjectGuitarTypeFilter,
  projectDateFrom,
  setProjectDateFrom,
  projectDateTo,
  setProjectDateTo,
  projectDueDateFrom,
  setProjectDueDateFrom,
  projectDueDateTo,
  setProjectDueDateTo,
  projectCompletionFilter,
  setProjectCompletionFilter,
  setProjectPage,
  openModal,
  isAdmin,
  setShowGuitarTypeSelector,
  showDefaultWorkflowEditor,
  setShowDefaultWorkflowEditor,
  deleteProject,
  restoreProject,
  projectArchiveTab,
  setProjectArchiveTab,
  archivedProjectsPagination,
  setArchivedProjectsPagination,
  projectsPagination,
  setProjectPageSize,
  debouncedSearch,
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [projectView, setProjectView] = useState('table')
  // A new page size invalidates the current offset, so both listings jump back to
  // page 1 and the shared project page size is reused for the active list.
  const changeProjectPageSize = (nextSize) => {
    setProjectPageSize(nextSize)
    setProjectPage(1)
  }
  const changeArchivedPageSize = (nextSize) => {
    setArchivedProjectsPagination((prev) => ({ ...prev, page: 1, pageSize: nextSize }))
  }
  const hasActiveFilters = projectStatusFilter !== 'all'
    || projectAssignedFilter !== 'all'
    || projectGuitarTypeFilter !== 'all'
    || Boolean(projectDateFrom || projectDateTo || projectDueDateFrom || projectDueDateTo)
    || projectCompletionFilter !== 'all'
  const resetFiltersAndSort = () => {
    setProjectStatusFilter('all')
    setProjectAssignedFilter('all')
    setProjectGuitarTypeFilter('all')
    setProjectDateFrom('')
    setProjectDateTo('')
    setProjectDueDateFrom('')
    setProjectDueDateTo('')
    setProjectCompletionFilter('all')
    setProjectSort('updated')
    setProjectSortDirection('desc')
    setProjectPage(1)
  }

  return (
    <motion.div key="projects" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-white text-xl font-semibold">Projects</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Open a project to manage milestones and subtasks for the build.
            </p>
<div className="mt-4 flex flex-wrap items-center gap-2">

  {/* Admin Actions */}
  {isAdmin && (
    <>
      <button
        type="button"
        onClick={() => setShowDefaultWorkflowEditor(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
      >
        <Settings className="w-4 h-4" />
        Edit Default Tasks
      </button>

      <button
        type="button"
        onClick={() => setShowGuitarTypeSelector(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>
    </>
  )}
  
  {/* Separator */}
  {isAdmin && (
    <div className="hidden sm:block h-7 w-px bg-[var(--border)] mx-1" />
  )}

  {/* Project Tabs */}
  <button
    type="button"
    onClick={() => setProjectArchiveTab('active')}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      projectArchiveTab === 'active'
        ? 'bg-[var(--gold-primary)] text-black'
        : 'border border-[var(--border)] bg-[var(--bg-primary)] text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]'
    }`}
  >
    <Briefcase className="w-4 h-4" />
    Active Projects
  </button>

  <button
    type="button"
    onClick={() => setProjectArchiveTab('archived')}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
      projectArchiveTab === 'archived'
        ? 'bg-[var(--gold-primary)] text-black'
        : 'border border-[var(--border)] bg-[var(--bg-primary)] text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]'
    }`}
  >
    <Archive className="w-4 h-4" />
    Archived Projects
  </button>
</div>
            <DefaultWorkflowEditor
              isOpen={showDefaultWorkflowEditor}
              onClose={() => setShowDefaultWorkflowEditor(false)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">Total</p>
              <p className="text-white text-lg font-semibold">{projects.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">In Progress</p>
              <p className="text-white text-lg font-semibold">{projects.filter((project) => project.status === 'in_progress').length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
              <p className="text-[var(--text-muted)] text-sm">Completed</p>
              <p className="text-white text-lg font-semibold">{projects.filter((project) => project.status === 'completed').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search - full width row */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value) }}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div role="group" aria-label="Project view" className="inline-flex shrink-0 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-1">
          {[{ value: 'table', label: 'Table view', icon: Table2 }, { value: 'card', label: 'Card view', icon: LayoutGrid }].map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" aria-pressed={projectView === value} onClick={() => setProjectView(value)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${projectView === value ? 'bg-[var(--gold-primary)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--gold-primary)]'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setFilterMenuOpen((open) => !open)}
            aria-expanded={filterMenuOpen}
            aria-haspopup="true"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3 text-sm font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
          >
            <Filter className="h-4 w-4" />
            Sort &amp; Filter
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-[var(--gold-primary)]" aria-label="Active filters" />}
            <ChevronDown className="h-4 w-4" />
          </button>

          {filterMenuOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 grid max-h-[70vh] w-[min(88vw,30rem)] gap-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 shadow-2xl sm:grid-cols-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Sort by
                <select value={projectSort} onChange={(event) => setProjectSort(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="updated">Recently updated</option>
                  <option value="created">Date created</option>
                  <option value="name">Project name</option>
                  <option value="customer">Customer name</option>
                  <option value="progress">Progress</option>
                  <option value="due">Due date</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Sort direction
                <select value={projectSortDirection} onChange={(event) => setProjectSortDirection(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Project status
                <select value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="all">All statuses</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Assigned staff
                <select value={projectAssignedFilter} onChange={(event) => setProjectAssignedFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="all">All assigned staff</option>
                  {(users || []).filter((user) => ['staff', 'admin', 'super_admin'].includes(user.role)).map((user) => (
                    <option key={user.user_id} value={user.user_id}>{user.first_name} {user.last_name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Guitar type
                <select value={projectGuitarTypeFilter} onChange={(event) => setProjectGuitarTypeFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="all">All guitar types</option>
                  <option value="Electric">Electric</option>
                  <option value="Acoustic">Acoustic</option>
                  <option value="Bass">Bass</option>
                  <option value="Classical">Classical</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Completion
                <select value={projectCompletionFilter} onChange={(event) => setProjectCompletionFilter(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-2 text-sm text-[var(--text-light)]">
                  <option value="all">Any completion</option>
                  <option value="0">0%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                </select>
              </label>
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                Created date range
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input type="date" aria-label="Project start date" value={projectDateFrom} onChange={(event) => setProjectDateFrom(event.target.value)} className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)]" />
                  <input type="date" aria-label="Project end date" value={projectDateTo} onChange={(event) => setProjectDateTo(event.target.value)} className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)]" />
                </div>
              </div>
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                Due date range
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <input type="date" aria-label="Due date start" value={projectDueDateFrom} onChange={(event) => setProjectDueDateFrom(event.target.value)} className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)]" />
                  <input type="date" aria-label="Due date end" value={projectDueDateTo} onChange={(event) => setProjectDueDateTo(event.target.value)} className="min-w-0 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-2 text-sm text-[var(--text-light)]" />
                </div>
              </div>
              <button type="button" onClick={resetFiltersAndSort} className="text-left text-xs font-semibold text-[var(--gold-primary)] hover:underline sm:col-span-2">
                Reset filters and sort
              </button>
            </div>
          )}
        </div>
      </div>

      {projectArchiveTab === 'active' ? (
        visibleProjects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            label={debouncedSearch ? 'No projects match your search' : 'No projects found'}
            action={isAdmin ? () => openModal('project') : undefined}
            actionLabel="Create Project"
          />
        ) : (
          <>
          {projectView === 'table' ? (
            <ProjectsTable projects={visibleProjects} isAdmin={isAdmin} openModal={openModal} deleteProject={deleteProject} footer={<PaginationBar attached pagination={projectsPagination} onPageChange={(nextPage) => setProjectPage(nextPage)} onPageSizeChange={changeProjectPageSize} />} />
          ) : <div className="grid gap-6 xl:grid-cols-2">
            {visibleProjects.map((project) => {
              const status = String(project.status || 'not_started').toLowerCase()
              const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0
              const statusClass = {
                not_started: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
                in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                on_hold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                completed: 'bg-green-500/10 text-green-300 border-green-500/30',
                cancelled: 'bg-red-500/10 text-red-300 border-red-500/30',
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
                       <p className="mt-2 text-sm text-[var(--text-muted)]">
                         Claimed By: <span className="text-white">{project.claimed_first_name ? `${project.claimed_first_name} ${project.claimed_last_name}` : 'Unassigned'}</span>
                       </p>
                      {status === 'on_hold' && project.hold_reason && (
                        <p className="mt-2 text-xs text-amber-300/80">
                          Hold reason: <span className="font-medium">{project.hold_reason}</span>
                        </p>
                      )}
                      {status === 'on_hold' && project.hold_requested_at && (
                        <p className="mt-0.5 text-xs text-amber-300/50">
                          {new Date(project.hold_requested_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    {project.cancel_requested_at && !project.cancel_approved_at && status !== 'cancelled' && (
                      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        Cancellation Requested
                      </span>
                    )}
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
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openModal('project', project)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {isAdmin && (
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
          </div>}
          {projectView !== 'table' && (
            <PaginationBar
              pagination={projectsPagination}
              onPageChange={(nextPage) => setProjectPage(nextPage)}
            />
          )}
          </>
        )
      ) : (
        visibleArchivedProjects.length === 0 ? (
          <EmptyState
            icon={Archive}
            label={debouncedSearch ? 'No archived projects match your search' : 'No archived projects'}
          />
        ) : (
          <>
          {projectView === 'table' ? (
            <ProjectsTable projects={visibleArchivedProjects} archived isAdmin={isAdmin} openModal={openModal} restoreProject={restoreProject} footer={<PaginationBar attached pagination={archivedProjectsPagination} onPageChange={(nextPage) => setArchivedProjectsPagination((prev) => ({ ...prev, page: nextPage }))} onPageSizeChange={changeArchivedPageSize} />} />
          ) : <div className="grid gap-6 xl:grid-cols-2">
            {visibleArchivedProjects.map((project) => {
              const status = String(project.status || 'not_started').toLowerCase()
              const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0
              const statusClass = {
                not_started: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
                in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
                on_hold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                completed: 'bg-green-500/10 text-green-300 border-green-500/30',
                cancelled: 'bg-red-500/10 text-red-300 border-red-500/30',
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
                       <p className="mt-2 text-sm text-[var(--text-muted)]">
                         Claimed By: <span className="text-white">{project.claimed_first_name ? `${project.claimed_first_name} ${project.claimed_last_name}` : 'Unassigned'}</span>
                       </p>
                      {status === 'on_hold' && project.hold_reason && (
                        <p className="mt-2 text-xs text-amber-300/80">
                          Hold reason: <span className="font-medium">{project.hold_reason}</span>
                        </p>
                      )}
                      {status === 'on_hold' && project.hold_requested_at && (
                        <p className="mt-0.5 text-xs text-amber-300/50">
                          {new Date(project.hold_requested_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                    {project.cancel_requested_at && !project.cancel_approved_at && status !== 'cancelled' && (
                      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        Cancellation Requested
                      </span>
                    )}
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
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => restoreProject(project.project_id, project.name || project.title || 'Project')}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>}
          {projectView !== 'table' && (
            <PaginationBar
              pagination={archivedProjectsPagination}
              onPageChange={(nextPage) => setArchivedProjectsPagination((prev) => ({ ...prev, page: nextPage }))}
            />
          )}
          </>
        )
      )}
    </motion.div>
  )
}
