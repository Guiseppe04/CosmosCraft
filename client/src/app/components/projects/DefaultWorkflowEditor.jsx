import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronDown, ChevronUp, Plus, Trash2, Edit3,
  Save, X, AlertCircle, CheckCircle, GripVertical,
  ArrowUp, ArrowDown
} from 'lucide-react'
import { adminApi } from '../../utils/adminApi'

export default function DefaultWorkflowEditor({ isOpen, onClose }) {
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [expandedSteps, setExpandedSteps] = useState(new Set())
  const [editingStepIndex, setEditingStepIndex] = useState(null)
  const [editingTaskKey, setEditingTaskKey] = useState(null) // "stepIdx:taskIdx"

  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminApi.getDefaultWorkflow()
      const data = res.data || []
      // Map to client-side format with temp IDs
      const mapped = data.map((step) => ({
        _tempId: step.step_id || generateTempId(),
        step_id: step.step_id,
        step_name: step.step_name,
        sort_order: step.sort_order,
        tasks: (step.tasks || []).map((task) => ({
          _tempId: task.task_id || generateTempId(),
          task_id: task.task_id,
          task_name: task.task_name,
          sort_order: task.sort_order,
        })),
      }))
      setSteps(mapped)
      // Auto-expand all steps
      setExpandedSteps(new Set(mapped.map((_, i) => i)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadWorkflow()
      setSuccess(null)
      setError(null)
    }
  }, [isOpen, loadWorkflow])

  const toggleStep = (idx) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleAddStep = () => {
    const newSteps = [...steps]
    newSteps.push({
      _tempId: generateTempId(),
      step_name: '',
      sort_order: newSteps.length + 1,
      tasks: [],
    })
    setSteps(newSteps)
    setExpandedSteps((prev) => new Set([...prev, newSteps.length - 1]))
    setEditingStepIndex(newSteps.length - 1)
  }

  const handleDeleteStep = (idx) => {
    if (!window.confirm(`Delete step "${steps[idx].step_name || 'Untitled'}"? This cannot be undone.`)) return
    const newSteps = steps.filter((_, i) => i !== idx)
    // Reindex sort_order
    newSteps.forEach((s, i) => (s.sort_order = i + 1))
    setSteps(newSteps)
  }

  const handleMoveStep = (idx, direction) => {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= steps.length) return
    const newSteps = [...steps]
    ;[newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]]
    newSteps.forEach((s, i) => (s.sort_order = i + 1))
    setSteps(newSteps)
  }

  const handleStepNameChange = (idx, value) => {
    const newSteps = [...steps]
    newSteps[idx] = { ...newSteps[idx], step_name: value }
    setSteps(newSteps)
  }

  const handleAddTask = (stepIdx) => {
    const newSteps = [...steps]
    const step = { ...newSteps[stepIdx] }
    step.tasks = [
      ...step.tasks,
      {
        _tempId: generateTempId(),
        task_name: '',
        sort_order: step.tasks.length + 1,
      },
    ]
    newSteps[stepIdx] = step
    setSteps(newSteps)
    setEditingTaskKey(`${stepIdx}:${step.tasks.length - 1}`)
  }

  const handleDeleteTask = (stepIdx, taskIdx) => {
    const task = steps[stepIdx].tasks[taskIdx]
    if (!window.confirm(`Delete task "${task.task_name || 'Untitled'}"?`)) return
    const newSteps = [...steps]
    const step = { ...newSteps[stepIdx] }
    step.tasks = step.tasks.filter((_, i) => i !== taskIdx)
    step.tasks.forEach((t, i) => (t.sort_order = i + 1))
    newSteps[stepIdx] = step
    setSteps(newSteps)
  }

  const handleMoveTask = (stepIdx, taskIdx, direction) => {
    const newTaskIdx = taskIdx + direction
    const tasks = steps[stepIdx].tasks
    if (newTaskIdx < 0 || newTaskIdx >= tasks.length) return
    const newSteps = [...steps]
    const step = { ...newSteps[stepIdx] }
    const newTasks = [...step.tasks]
    ;[newTasks[taskIdx], newTasks[newTaskIdx]] = [newTasks[newTaskIdx], newTasks[taskIdx]]
    newTasks.forEach((t, i) => (t.sort_order = i + 1))
    step.tasks = newTasks
    newSteps[stepIdx] = step
    setSteps(newSteps)
  }

  const handleTaskNameChange = (stepIdx, taskIdx, value) => {
    const newSteps = [...steps]
    const step = { ...newSteps[stepIdx] }
    const tasks = [...step.tasks]
    tasks[taskIdx] = { ...tasks[taskIdx], task_name: value }
    step.tasks = tasks
    newSteps[stepIdx] = step
    setSteps(newSteps)
  }

  const validate = () => {
    const errors = []
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.step_name || !step.step_name.trim()) {
        errors.push(`Step ${i + 1}: Step name is required`)
      }
      for (let j = 0; j < step.tasks.length; j++) {
        if (!step.tasks[j].task_name || !step.tasks[j].task_name.trim()) {
          errors.push(`Step "${step.step_name || `#${i + 1}`}", Task ${j + 1}: Task name is required`)
        }
      }
    }
    return errors
  }

  const handleSave = async () => {
    const validationErrors = validate()
    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'))
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const payload = steps.map((step, i) => ({
        step_name: step.step_name.trim(),
        sort_order: step.sort_order || i + 1,
        tasks: step.tasks.map((task, j) => ({
          task_name: task.task_name.trim(),
          sort_order: task.sort_order || j + 1,
        })),
      }))

      await adminApi.updateDefaultWorkflow({ steps: payload })
      setSuccess('Default workflow saved successfully! Changes will apply to future projects only.')
      await loadWorkflow()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 pb-8 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl max-h-[calc(100vh-6rem)] overflow-y-auto bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl shadow-2xl custom-scrollbar"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface-dark)] border-b border-[var(--border)] px-6 py-5 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Default Tasks</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Changes only affect future projects. Existing projects keep their current tasks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full" />
              <span className="ml-3 text-[var(--text-muted)]">Loading default workflow...</span>
            </div>
          ) : (
            <>
              {/* Error / Success Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm whitespace-pre-line"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Steps */}
              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-white font-semibold">No steps defined</p>
                  <p className="text-[var(--text-muted)] text-sm mt-1">Add your first step to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, stepIdx) => {
                    const isExpanded = expandedSteps.has(stepIdx)
                    const isEditing = editingStepIndex === stepIdx

                    return (
                      <div
                        key={step._tempId}
                        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden"
                      >
                        {/* Step Header */}
                        <div className="flex items-center gap-2 p-3">
                          <div className="flex flex-col gap-0.5 opacity-40">
                            <button
                              onClick={() => handleMoveStep(stepIdx, -1)}
                              disabled={stepIdx === 0}
                              className="disabled:opacity-30 hover:text-white transition-colors"
                            >
                              <ArrowUp className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                            <button
                              onClick={() => handleMoveStep(stepIdx, 1)}
                              disabled={stepIdx === steps.length - 1}
                              className="disabled:opacity-30 hover:text-white transition-colors"
                            >
                              <ArrowDown className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                          </div>

                          <GripVertical className="w-4 h-4 text-[var(--text-muted)]/30 cursor-grab" />

                          <button
                            onClick={() => toggleStep(stepIdx)}
                            className="flex-1 flex items-center gap-3 text-left"
                          >
                            <span className="w-6 h-6 rounded-md bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] text-xs font-bold flex items-center justify-center">
                              {stepIdx + 1}
                            </span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={step.step_name}
                                onChange={(e) => handleStepNameChange(stepIdx, e.target.value)}
                                onBlur={() => setEditingStepIndex(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingStepIndex(null)
                                }}
                                placeholder="Step name"
                                className="bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-lg px-2 py-1 text-white text-sm font-semibold focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className="text-white font-semibold text-sm">
                                {step.step_name || <span className="text-[var(--text-muted)] italic">Untitled</span>}
                              </span>
                            )}
                          </button>

                          <span className="text-[var(--text-muted)] text-xs">{step.tasks.length} tasks</span>

                          <button
                            onClick={() => setEditingStepIndex(isEditing ? null : stepIdx)}
                            className="p-1.5 hover:bg-[var(--gold-primary)]/20 rounded-lg transition-colors"
                            title="Edit step name"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          </button>

                          <button
                            onClick={() => handleDeleteStep(stepIdx)}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete step"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>

                          <button
                            onClick={() => toggleStep(stepIdx)}
                            className="p-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                            )}
                          </button>
                        </div>

                        {/* Tasks List */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-[var(--border)]"
                            >
                              <div className="p-3 space-y-2">
                                {step.tasks.length === 0 && (
                                  <p className="text-[var(--text-muted)] text-xs text-center py-3">
                                    No tasks in this step. Add one below.
                                  </p>
                                )}

                                {step.tasks.map((task, taskIdx) => {
                                  const taskKey = `${stepIdx}:${taskIdx}`
                                  const isTaskEditing = editingTaskKey === taskKey

                                  return (
                                    <div
                                      key={task._tempId}
                                      className="flex items-center gap-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-2 group"
                                    >
                                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleMoveTask(stepIdx, taskIdx, -1)}
                                          disabled={taskIdx === 0}
                                          className="disabled:opacity-30 hover:text-white transition-colors"
                                        >
                                          <ArrowUp className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                        </button>
                                        <button
                                          onClick={() => handleMoveTask(stepIdx, taskIdx, 1)}
                                          disabled={taskIdx === step.tasks.length - 1}
                                          className="disabled:opacity-30 hover:text-white transition-colors"
                                        >
                                          <ArrowDown className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                        </button>
                                      </div>

                                      <span className="text-[var(--text-muted)] text-xs font-mono w-4">
                                        {taskIdx + 1}
                                      </span>

                                      {isTaskEditing ? (
                                        <input
                                          type="text"
                                          value={task.task_name}
                                          onChange={(e) => handleTaskNameChange(stepIdx, taskIdx, e.target.value)}
                                          onBlur={() => setEditingTaskKey(null)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') setEditingTaskKey(null)
                                          }}
                                          placeholder="Task name"
                                          className="flex-1 bg-[var(--bg-primary)] border border-[var(--gold-primary)] rounded px-2 py-1 text-white text-sm focus:outline-none"
                                          autoFocus
                                        />
                                      ) : (
                                        <span className="flex-1 text-white text-sm">
                                          {task.task_name || <span className="text-[var(--text-muted)] italic">Untitled</span>}
                                        </span>
                                      )}

                                      <button
                                        onClick={() => setEditingTaskKey(isTaskEditing ? null : taskKey)}
                                        className="p-1 hover:bg-[var(--gold-primary)]/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit task name"
                                      >
                                        <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />
                                      </button>

                                      <button
                                        onClick={() => handleDeleteTask(stepIdx, taskIdx)}
                                        className="p-1 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete task"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                      </button>
                                    </div>
                                  )
                                })}

                                <button
                                  onClick={() => handleAddTask(stepIdx)}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-[var(--border)] rounded-lg text-[var(--text-muted)] text-xs hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Task
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Step Button */}
              <button
                onClick={handleAddStep}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] text-sm hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--surface-dark)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-between rounded-b-2xl">
          <p className="text-xs text-[var(--text-muted)]">
            {steps.length} step{steps.length !== 1 ? 's' : ''},{' '}
            {steps.reduce((sum, s) => sum + s.tasks.length, 0)} task{steps.reduce((sum, s) => sum + s.tasks.length, 0) !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-60 transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Default Workflow'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}