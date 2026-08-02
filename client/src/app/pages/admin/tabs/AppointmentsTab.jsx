import { motion } from 'motion/react'
import { CalendarX } from 'lucide-react'
import AppointmentCalendar from '../../../components/appointments/AppointmentCalendar'
import AppointmentList from '../../../components/appointments/AppointmentList'

export function AppointmentsTab({
  visibleAppointments,
  appointmentLoading,
  appointmentPagination,
  selectedCalendarDate,
  unavailableDates,
  fetchAppointments,
  setSelectedAppointment,
  setAppointmentModalOpen,
  setAppointmentFormData,
  setAppointmentFormOpen,
  setUnavailableDatesOpen,
  setAppointmentPagination,
  isSuperAdmin,
}) {
  return (
    <motion.div key="appointments" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-xl font-semibold">Appointments</h2>
          <p className="text-[var(--text-muted)] text-sm">Manage customer appointments and schedules</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setUnavailableDatesOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black rounded-xl font-semibold text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
          >
            <CalendarX className="w-4 h-4" />
            Mark Unavailable
          </button>
        )}
      </div>

      <AppointmentCalendar
        appointments={visibleAppointments}
        onAppointmentClick={(apt) => {
          setSelectedAppointment(apt)
          setAppointmentModalOpen(true)
        }}
        unavailableDates={unavailableDates}
        isAdminMode
      />

      <div className="mt-8">
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
        />
      </div>
    </motion.div>
  )
}
