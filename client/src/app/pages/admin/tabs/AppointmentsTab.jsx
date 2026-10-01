import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { CalendarX, List, Calendar } from 'lucide-react'
import AppointmentCalendar from '../../../components/appointments/AppointmentCalendar'
import AppointmentList from '../../../components/appointments/AppointmentList'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

export function AppointmentsTab({
  visibleAppointments,
  visibleCalendarAppointments,
  appointmentLoading,
  appointmentPagination,
  selectedCalendarDate,
  unavailableDates,
  availableDates,
  fetchAppointments,
  setSelectedAppointment,
  setAppointmentModalOpen,
  setAppointmentFormData,
  setAppointmentFormOpen,
  setUnavailableDatesOpen,
  setAppointmentPagination,
  isSuperAdmin,
  searchQuery,
  onSearchChange,
}) {
  const [showAppointmentsTable, setShowAppointmentsTable] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  // Calendar uses the full unpaginated/paginated list filtered by status if selected
  const calendarData = useMemo(() => {
    const base = visibleCalendarAppointments ?? visibleAppointments ?? []
    if (statusFilter === 'all') return base
    return base.filter((apt) => apt.status === statusFilter)
  }, [visibleCalendarAppointments, visibleAppointments, statusFilter])

  return (
    <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Filter and Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Far Left: All Statuses Filter & Mark Unavailable */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-light)] focus:border-[var(--gold-primary)] focus:outline-none transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {isSuperAdmin && (
            <button
              onClick={() => setUnavailableDatesOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all shrink-0"
            >
              <CalendarX className="w-4 h-4" />
              <span>Mark Unavailable</span>
            </button>
          )}
        </div>

        {/* Right Part: Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAppointmentsTable((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm font-semibold text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-all shrink-0"
          >
            {showAppointmentsTable ? (
              <>
                <Calendar className="w-4 h-4 text-[var(--gold-primary)]" />
                <span>View Calendar</span>
              </>
            ) : (
              <>
                <List className="w-4 h-4 text-[var(--gold-primary)]" />
                <span>View Appointments</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!showAppointmentsTable ? (
        <AppointmentCalendar
          appointments={calendarData}
          onAppointmentClick={(apt) => {
            setSelectedAppointment(apt)
            setAppointmentModalOpen(true)
          }}
          unavailableDates={unavailableDates}
          availableDates={availableDates}
          isAdminMode
        />
      ) : (
        <AppointmentList
          appointments={visibleAppointments}
          loading={appointmentLoading}
          onRefresh={fetchAppointments}
          onViewDetails={(apt) => {
            setSelectedAppointment(apt)
            setAppointmentModalOpen(true)
          }}
          onEdit={(apt) => {
            setAppointmentFormData(apt)
            setAppointmentFormOpen(true)
          }}
          onCreateNew={() => setAppointmentFormOpen(true)}
          pagination={appointmentPagination}
          onPageChange={(page) => setAppointmentPagination((prev) => ({ ...prev, page }))}
          selectedDate={selectedCalendarDate}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      )}
    </motion.div>
  )
}
