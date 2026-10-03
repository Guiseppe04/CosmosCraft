import { useEffect, useRef, useState } from 'react'
import { Clock, Loader2, Save, X } from 'lucide-react'
import { adminApi } from '../../../../utils/adminApi'

export function GracePeriodModal({ onClose }) {
  const dialog = useRef(null)
  const [minutes, setMinutes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    dialog.current.showModal()
    let live = true
    adminApi.getPaymentSettings().then(res => {
      if (live) setMinutes(String(res.data?.no_show_grace_minutes ?? 30))
    }).catch(err => { if (live) setError(err.message || 'Failed to load grace period') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])
  const save = async event => {
    event.preventDefault()
    const value = Number(minutes)
    if (minutes.trim() === '' || !Number.isInteger(value) || value < 0 || value > 1440) {
      setError('Enter a whole number from 0 to 1440 minutes.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await adminApi.updatePaymentSettings({ no_show_grace_minutes: value })
      onClose()
    } catch (err) { setError(err.message || 'Failed to save grace period'); setSaving(false) }
  }
  return <dialog ref={dialog} aria-labelledby="grace-period-title" aria-describedby="grace-period-description"
    onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !saving) onClose() }}
    className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-0 text-[var(--text-light)] shadow-2xl backdrop:bg-black/70">
    <form onSubmit={save} className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 id="grace-period-title" className="text-xl font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-[var(--gold-primary)]" />Appointment No-show Grace Period</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close grace period" className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50"><X className="w-5 h-5" /></button>
      </div>
      <p id="grace-period-description" className="text-sm text-[var(--text-muted)] mb-5">Confirmed appointments are marked No Show after this many minutes past their scheduled time, unless service has started. For example, 3:00 PM with 30 minutes becomes No Show at 3:30 PM.</p>
      {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading grace period...</p> : <label className="block text-sm font-semibold">Grace period (minutes)
        <input type="number" required min="0" max="1440" step="1" value={minutes} disabled={saving}
          onChange={event => setMinutes(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-white focus:border-[var(--gold-primary)] focus:outline-none" />
      </label>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-[var(--border)] disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={loading || saving || minutes === ''} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Grace Period'}
        </button>
      </div>
    </form>
  </dialog>
}
