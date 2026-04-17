import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  X, Search, Loader2, CheckCircle, CalendarDays, Clock3, User,
} from 'lucide-react'
import { format } from 'date-fns'

function buildTimeSlots(dateValue) {
  if (!dateValue) return []

  const date = new Date(dateValue)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isToday = date.toDateString() === today.toDateString()
  const startHour = isToday ? Math.max(9, new Date().getHours() + 1) : 9
  const slots = []

  for (let hour = startHour; hour < 18; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      slots.push({
        value,
        label: format(new Date(`2000-01-01T${value}`), 'h:mm a'),
      })
    }
  }

  return slots
}

export default function AppointmentForm({
  open,
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  services = [],
  users = [],
  loading = false,
  selectedDate = null,
}) {
  const modalOpen = isOpen ?? open
  const isEditing = Boolean(initialData?.appointment_id)
  const [formData, setFormData] = useState({
    user_id: '',
    service_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  useEffect(() => {
    if (!modalOpen) return

    const scheduledAtValue = initialData?.scheduled_at || initialData?.scheduledAt
    const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null
    const firstServiceId = initialData?.service_id || initialData?.services?.[0] || ''

    setFormData({
      user_id: initialData?.user_id || '',
      service_id: firstServiceId,
      scheduled_date: scheduledAt ? format(scheduledAt, 'yyyy-MM-dd') : (selectedDate || format(new Date(), 'yyyy-MM-dd')),
      scheduled_time: scheduledAt ? format(scheduledAt, 'HH:mm') : '',
      notes: initialData?.notes || '',
    })
    setErrors({})
    setUserSearch('')
    setShowUserDropdown(false)
  }, [modalOpen, initialData, selectedDate])

  const availableSlots = useMemo(
    () => buildTimeSlots(formData.scheduled_date),
    [formData.scheduled_date]
  )

  const selectedUser = useMemo(
    () => users.find((candidate) => candidate.user_id === formData.user_id) || null,
    [users, formData.user_id]
  )

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users.slice(0, 8)
    const query = userSearch.trim().toLowerCase()
    return users.filter((candidate) => {
      const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim().toLowerCase()
      return fullName.includes(query) || candidate.email?.toLowerCase().includes(query)
    }).slice(0, 8)
  }, [users, userSearch])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!formData.service_id) {
      nextErrors.service_id = 'Please select a service'
    }
    if (!formData.scheduled_date) {
      nextErrors.scheduled_date = 'Date is required'
    }
    if (!formData.scheduled_time) {
      nextErrors.scheduled_time = 'Time is required'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleUserSelect = (selected) => {
    setFormData((prev) => ({ ...prev, user_id: selected.user_id }))
    setUserSearch('')
    setShowUserDropdown(false)
  }

  const clearSelectedUser = () => {
    setFormData((prev) => ({ ...prev, user_id: '' }))
    setUserSearch('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    const scheduledAt = `${formData.scheduled_date}T${formData.scheduled_time}:00`
    const payload = isEditing
      ? {
        scheduled_at: scheduledAt,
        notes: formData.notes || '',
      }
      : {
        appointment_type: 'service_in_shop',
        services: [formData.service_id],
        scheduled_at: scheduledAt,
        notes: formData.notes || '',
        ...(formData.user_id ? { user_id: formData.user_id } : {}),
      }

    try {
      await onSubmit?.(payload)
      onClose?.()
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        form: error?.message || 'Unable to save appointment',
      }))
    }
  }

  if (!modalOpen) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[520px] max-h-[92vh] overflow-y-auto rounded-[28px] border border-white/10 bg-[#413b3b] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 border-b border-white/10 bg-[#413b3b] px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[28px] font-semibold text-white sm:text-[32px]">
                  {isEditing ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                <p className="mt-2 text-sm text-[#d4d0d0]">
                  {isEditing ? 'Update the schedule and notes for this appointment.' : 'Create a new in-shop service appointment.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-[#d1cbcb] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
            {users.length > 0 && !isEditing && (
              <div className="space-y-3">
                <label className="block text-sm text-[#d4d0d0]">Customer account</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#3a3535] px-4 py-3">
                    <div>
                      <p className="font-medium text-white">
                        {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email}
                      </p>
                      <p className="text-sm text-[#d4d0d0]">{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearSelectedUser}
                      className="text-sm font-medium text-[#ffd21c]"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa4ad]" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(event) => {
                        setUserSearch(event.target.value)
                        setShowUserDropdown(true)
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      placeholder="Search user by name or email"
                      className="w-full rounded-xl border border-white/10 bg-[#3a3535] py-3 pl-10 pr-4 text-white placeholder:text-[#9aa4ad] focus:border-white/20 focus:outline-none"
                    />
                    {showUserDropdown && filteredUsers.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#2f2a2a] shadow-xl">
                        {filteredUsers.map((candidate) => (
                          <button
                            key={candidate.user_id}
                            type="button"
                            onClick={() => handleUserSelect(candidate)}
                            className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/5"
                          >
                            <div className="rounded-xl bg-white/5 p-2 text-[#ffd21c]">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {`${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || candidate.email}
                              </p>
                              <p className="text-sm text-[#d4d0d0]">{candidate.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-[#9aa4ad]">
                  Optional. Leave blank to create an unassigned appointment record.
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-[#d4d0d0]">Service *</label>
              <select
                value={formData.service_id}
                onChange={(event) => handleInputChange('service_id', event.target.value)}
                disabled={isEditing}
                className="w-full rounded-xl border border-white/10 bg-[#3a3535] px-4 py-3 text-white focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.service_id} value={service.service_id}>
                    {service.name} {service.duration_minutes ? `(${service.duration_minutes} min)` : ''}
                  </option>
                ))}
              </select>
              {isEditing && (
                <p className="mt-2 text-xs text-[#9aa4ad]">
                  Service changes are handled outside this modal. Use the appointment actions for status and payment updates.
                </p>
              )}
              {errors.service_id && (
                <p className="mt-2 text-sm text-red-400">{errors.service_id}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm text-[#d4d0d0]">
                  <CalendarDays className="h-4 w-4" />
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(event) => handleInputChange('scheduled_date', event.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full rounded-xl border border-white/10 bg-[#3a3535] px-4 py-3 text-white focus:border-white/20 focus:outline-none"
                />
                {errors.scheduled_date && (
                  <p className="mt-2 text-sm text-red-400">{errors.scheduled_date}</p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm text-[#d4d0d0]">
                  <Clock3 className="h-4 w-4" />
                  Time *
                </label>
                <select
                  value={formData.scheduled_time}
                  onChange={(event) => handleInputChange('scheduled_time', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#3a3535] px-4 py-3 text-white focus:border-white/20 focus:outline-none"
                >
                  <option value="">Select time...</option>
                  {availableSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
                {errors.scheduled_time && (
                  <p className="mt-2 text-sm text-red-400">{errors.scheduled_time}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#d4d0d0]">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(event) => handleInputChange('notes', event.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#3a3535] px-4 py-3 text-white placeholder:text-[#9aa4ad] focus:border-white/20 focus:outline-none"
                placeholder="Add workshop notes, prep details, or instructions..."
              />
            </div>

            {errors.form && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errors.form}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-[#d4d0d0] transition-colors hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-[#ffd21c] px-6 py-3 font-semibold text-black transition-colors hover:bg-[#ffda3a] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {isEditing ? 'Update Appointment' : 'Create Appointment'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
