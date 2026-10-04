import { useRef, useState } from 'react'
import { adminApi } from '../../utils/adminApi'

export default function ProjectTaskForm({ milestoneId, task, staff = [], onSaved, onCancel }) {
  const [form, setForm] = useState({
    title: task?.title || '', status: task?.status || 'pending',
    progress: task?.status === 'completed' ? 100 : Number(task?.progress || 0),
    assigned_user_id: task?.assigned_user_id || '', due_date: task?.due_date?.slice(0, 10) || '',
    notes: task?.notes || '', is_customer_updatable: Boolean(task?.is_customer_updatable),
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const field = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: null })) }
  const save = async event => {
    event.preventDefault()
    if (inFlight.current) return
    const invalid = {}
    if (!form.title.trim()) invalid.title = 'Task name is required.'
    if (form.title.trim().length > 200) invalid.title = 'Task name must not exceed 200 characters.'
    if (task && (form.progress === '' || !Number.isInteger(Number(form.progress)) || Number(form.progress) < 0 || Number(form.progress) > 100)) invalid.progress = 'Enter a whole number from 0 to 100.'
    if (Object.keys(invalid).length) { setErrors(invalid); return }
    inFlight.current = true
    setSaving(true)
    setErrors({})
    const payload = { title: form.title.trim(), assigned_user_id: form.assigned_user_id || null,
      due_date: form.due_date || null, notes: form.notes.trim(), is_customer_updatable: form.is_customer_updatable,
      ...(task ? { status: form.status, progress: Number(form.progress) } : {}) }
    try {
      const result = task ? await adminApi.updateSubtask(task.subtask_id, payload) : await adminApi.createSubtask(milestoneId, payload)
      await onSaved(result)
    } catch (error) {
      const details = Object.fromEntries((error.fieldErrors || []).map(item => [item.field, item.message]))
      setErrors(Object.keys(details).length ? details : { form: error.message })
    } finally { inFlight.current = false; setSaving(false) }
  }
  const inputClass = 'block mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-white'
  const errorFor = key => errors[key] && <p role="alert" className="mt-1 text-xs text-red-400">{errors[key]}</p>
  const members = [...new Map(staff.map(member => [member.user_id, member])).values()].filter(member => member.role !== 'customer' && member.is_active !== false)

  return <form onSubmit={save} noValidate className="p-4 my-3 bg-[var(--surface-dark)] border border-[var(--gold-primary)]/50 rounded-xl text-sm text-white">
    <h4 className="font-semibold mb-3">{task ? 'Edit Task' : 'Add Task'}</h4>
    <fieldset disabled={saving} className="space-y-3">
      <label className="block">Task name<input autoFocus value={form.title} maxLength={200} onChange={event => field('title', event.target.value)} aria-invalid={Boolean(errors.title)} className={inputClass} />{errorFor('title')}</label>
      {task && <div className="grid sm:grid-cols-2 gap-3">
        <label>Status<select className={inputClass} value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value, progress: event.target.value === 'completed' ? 100 : event.target.value === 'pending' ? 0 : Math.min(99, Number(previous.progress) || 0) }))}>
          <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
        </select>{errorFor('status')}</label>
        <label>Progress (%)<input type="number" min={0} max={100} step={1} className={inputClass} value={form.progress} onChange={event => setForm(previous => ({ ...previous, progress: event.target.value, status: Number(event.target.value) === 100 ? 'completed' : Number(event.target.value) > 0 ? 'in_progress' : 'pending' }))} />{errorFor('progress')}</label>
      </div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <label>Assigned staff<select className={inputClass} value={form.assigned_user_id} onChange={event => field('assigned_user_id', event.target.value)}>
          <option value="">Unassigned</option>
          {form.assigned_user_id && !members.some(member => member.user_id === form.assigned_user_id) && <option value={form.assigned_user_id}>Current assignee</option>}
          {members.map(member => <option key={member.user_id} value={member.user_id}>{member.first_name} {member.last_name}</option>)}
        </select>{errorFor('assigned_user_id')}</label>
        <label>Due date (optional)<input type="date" className={inputClass} value={form.due_date} onChange={event => field('due_date', event.target.value)} />{errorFor('due_date')}</label>
      </div>
      <label className="block">Notes (optional)<textarea maxLength={2000} value={form.notes} onChange={event => field('notes', event.target.value)} className={inputClass} />{errorFor('notes')}</label>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={form.is_customer_updatable} onChange={event => field('is_customer_updatable', event.target.checked)} />Allow customer to mark this task complete</label>
      {errorFor('is_customer_updatable')}{errorFor('form')}
      <div className="flex gap-3"><button type="submit" className="px-4 py-2 rounded-lg bg-[var(--gold-primary)] text-black font-semibold">{saving ? 'Saving...' : 'Save Task'}</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-[var(--border)]">Cancel</button></div>
    </fieldset>
  </form>
}
