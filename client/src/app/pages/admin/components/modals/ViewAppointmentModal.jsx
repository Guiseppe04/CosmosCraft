import { ModalHeader } from '../shared/ModalHeader'

export function ViewAppointmentModal({ modal, closeModal }) {
  if (!modal.data) return null

  const apt = modal.data
  const apptDate = apt.scheduled_at || apt.date
  let guitarDetails = apt?.guitar_details
  if (typeof guitarDetails === 'string') {
    try {
      guitarDetails = JSON.parse(guitarDetails)
    } catch {
      guitarDetails = null
    }
  }

  const mappedFromDetails = Array.isArray(guitarDetails?.guitars) && guitarDetails.guitars.length > 0
    ? guitarDetails.guitars
    : (guitarDetails ? [guitarDetails] : [])

  const mappedFromNotes = (typeof apt?.notes === 'string' ? apt.notes.split('\n') : [])
    .map((line) => {
      const match = line.match(/^Guitar\s+\d+:\s*(.+?)\s+\(([^)]+)\)\s*$/i)
      if (!match) return null
      const descriptor = match[1]?.trim() || ''
      const [brand, ...modelParts] = descriptor.split(' ')
      return {
        brand: brand || '',
        model: modelParts.join(' ') || '',
        type: String(match[2] || '').trim().toLowerCase(),
        serial: 'N/A',
        notes: '',
      }
    })
    .filter(Boolean)

  const appointmentGuitars = (mappedFromDetails.length > 0 ? mappedFromDetails : mappedFromNotes)
    .map((guitar) => ({
      ...guitar,
      brand: guitar?.brand || guitar?.name || '',
      model: guitar?.model || guitar?.variant || '',
      type: guitar?.type || guitar?.guitar_type || '',
      serial: guitar?.serial || guitar?.serialNumber || 'N/A',
    }))
    .filter((guitar) => guitar.brand || guitar.model || guitar.type || guitar.notes)
  const primaryGuitar = appointmentGuitars[0] || null
  const statusColors = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    approved: 'bg-green-500/10 text-green-400 border-green-500/30',
    confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    in_progress: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    ready_for_pickup: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
    no_show: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  }
  const statusCls = statusColors[apt.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'

  return (
    <>
      <ModalHeader title="Appointment Summary" onClose={closeModal} />
      <div className="mt-6 space-y-6 text-sm">
        <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                {primaryGuitar ? `${primaryGuitar.brand || ''} ${primaryGuitar.model || ''}`.trim() : (apt.title || apt.service_name || 'Appointment')}
              </h3>
              <p className="text-[var(--text-muted)] font-mono text-xs">Ref: {apt.reference_code || apt.appointment_id || apt.id || 'N/A'}</p>
            </div>
            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full border ${statusCls}`}>
              {apt.status || 'Pending'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Schedule</p>
              <p className="text-white font-medium">{apptDate ? new Date(apptDate).toLocaleDateString() : '—'}</p>
              <p className="text-[var(--text-muted)]">{apt.time || (apptDate ? new Date(apptDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Branch</p>
              <p className="text-white font-medium capitalize">{apt.location_id || 'Main Branch'}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Customer Information</p>
            <div className="space-y-3">
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Name</p>
                <p className="text-white font-medium">{apt.customer_name || apt.user_name || '—'}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Email</p>
                <p className="text-white">{apt.customer_email || apt.user_email || '—'}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] text-xs mb-0.5">Phone</p>
                <p className="text-white">{apt.customer_phone || apt.user_phone || '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Guitar Details</p>
            {appointmentGuitars.length > 0 ? (
              <div className="space-y-3">
                {appointmentGuitars.map((guitar, index) => (
                  <div key={`${guitar?.brand || 'guitar'}-${guitar?.model || index}-${index}`} className={index > 0 ? 'pt-3 mt-3 border-t border-[var(--border)]' : ''}>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5">Brand & Model</p>
                    <p className="text-white font-medium">{guitar?.brand || '—'} {guitar?.model || ''}</p>
                    <p className="text-[var(--text-muted)] text-xs mb-0.5 mt-2">Serial Number</p>
                    <p className="text-white">{guitar?.serial || guitar?.serialNumber || '—'}</p>
                    {guitar?.type && (
                      <div className="mt-2">
                        <p className="text-[var(--text-muted)] text-xs mb-0.5">Type</p>
                        <p className="text-white capitalize">{guitar.type}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-sm italic">No detailed guitar specs provided.</p>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">Requested Services</p>
          {Array.isArray(apt.service_names) && apt.service_names.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-white">
              {apt.service_names.map((s, i) => <li key={i} className="capitalize">{String(s).replace(/-/g, ' ')}</li>)}
            </ul>
          ) : apt.service_name ? (
            <p className="text-white capitalize">{apt.service_name}</p>
          ) : Array.isArray(apt.services) && apt.services.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-white">
              {apt.services.map((s, i) => <li key={i} className="capitalize">{String(s).replace(/-/g, ' ')}</li>)}
            </ul>
          ) : (
            <p className="text-white capitalize">Consultation</p>
          )}
        </div>

        {apt.reason && (
          <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)] flex flex-col items-start gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Reason</p>
            <p className="text-white bg-[var(--surface-dark)] p-4 rounded-lg border border-[var(--border)] leading-relaxed w-full min-h-[60px] whitespace-pre-wrap">{apt.reason}</p>
          </div>
        )}

        {apt.notes && (
          <div className="bg-[var(--bg-primary)] p-5 rounded-xl border border-[var(--border)] flex flex-col items-start gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Additional Notes</p>
            <p className="text-white bg-[var(--surface-dark)] p-4 rounded-lg border border-[var(--border)] leading-relaxed w-full min-h-[60px] whitespace-pre-wrap">{apt.notes.split('\n').filter((line) => {
              const trimmed = line.trim()
              if (!trimmed) return false
              if (/(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i.test(trimmed)) return false
              const prefixes = ['Cancelled:', 'Status changed:', 'Rescheduled:', 'Cancelled on', 'Guitar ']
              return !prefixes.some((p) => trimmed.startsWith(p))
            }).join('\n')}</p>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button onClick={closeModal} className="px-6 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white hover:bg-[var(--bg-primary)] transition-colors font-semibold">
            Close Summary
          </button>
        </div>
      </div>
    </>
  )
}
