import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X, Calendar, Clock, User, Mail, Phone, FileText, Search,
  ChevronDown, Loader2, AlertCircle, CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'

// Main AppointmentForm component
export default function AppointmentForm({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  services = [],
  users = [],
  loading = false,
  selectedDate = null,
}) {
  const [formData, setFormData] = useState({
    customer_type: 'existing', // 'existing' or 'new'
    user_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    service_id: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
    status: 'approved',
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [searchUsers, setSearchUsers] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [errors, setErrors] = useState({})

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit mode
        const scheduledAt = new Date(initialData.scheduled_at || initialData.scheduledAt)
        setFormData({
          customer_type: initialData.user_id ? 'existing' : 'new',
          user_id: initialData.user_id || '',
          customer_name: initialData.customer_name || initialData.user_name || '',
          customer_email: initialData.customer_email || initialData.user_email || '',
          customer_phone: initialData.customer_phone || initialData.user_phone || '',
          service_id: initialData.service_id || '',
          scheduled_date: format(scheduledAt, 'yyyy-MM-dd'),
          scheduled_time: format(scheduledAt, 'HH:mm'),
          notes: initialData.notes || '',
          status: initialData.status || 'approved',
        })
      } else {
        // Create mode
        setFormData({
          customer_type: 'existing',
          user_id: '',
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          service_id: '',
          scheduled_date: selectedDate || format(new Date(), 'yyyy-MM-dd'),
          scheduled_time: '',
          notes: '',
          status: 'approved',
        })
      }
      setErrors({})
    }
  }, [isOpen, initialData, selectedDate])

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchUsers) return users.slice(0, 10)
    const query = searchUsers.toLowerCase()
    return users.filter(user =>
      user.email?.toLowerCase().includes(query) ||
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query)
    ).slice(0, 10)
  }, [users, searchUsers])

  // Load available slots when date or service changes
  useEffect(() => {
    if (formData.scheduled_date && formData.service_id) {
      loadAvailableSlots()
    }
  }, [formData.scheduled_date, formData.service_id])

  const loadAvailableSlots = async () => {
    setLoadingSlots(true)
    try {
      // This would call the API to get available slots
      // For now, we'll generate some mock slots
      const slots = generateTimeSlots(formData.scheduled_date)
      setAvailableSlots(slots)
    } catch (error) {
      console.error('Failed to load slots:', error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const generateTimeSlots = (date) => {
    const slots = []
    const dateObj = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Only generate future slots
    const isToday = dateObj.toDateString() === today.toDateString()
    const startHour = isToday ? Math.max(9, new Date().getHours() + 1) : 9
    
    for (let hour = startHour; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
        slots.push({
          value: time,
          label: format(new Date(`2000-01-01T${time}`), 'h:mm a'),
        })
      }
    }
    return slots
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleUserSelect = (user) => {
    setFormData(prev => ({
      ...prev,
      user_id: user.user_id,
      customer_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      customer_email: user.email || '',
      customer_phone: user.phone || '',
    }))
    setSearchUsers('')
    setShowUserDropdown(false)
  }

  const validateForm = () => {
    const newErrors = {}

    if (formData.customer_type === 'existing' && !formData.user_id) {
      newErrors.user_id = 'Please select a customer'
    }

    if (formData.customer_type === 'new') {
      if (!formData.customer_name.trim()) {
        newErrors.customer_name = 'Customer name is required'
      }
      if (!formData.customer_email.trim()) {
        newErrors.customer_email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
        newErrors.customer_email = 'Invalid email format'
      }
    }

    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'Date is required'
    }

    if (!formData.scheduled_time) {
      newErrors.scheduled_time = 'Time is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const scheduledAt = `${formData.scheduled_date}T${formData.scheduled_time}:00`
    
    const data = {
      scheduled_at: scheduledAt,
      status: formData.status,
      notes: formData.notes || null,
      services: formData.service_id ? [formData.service_id] : [],
    }

    if (formData.customer_type === 'existing') {
      data.user_id = formData.user_id
    } else {
      data.customer_name = formData.customer_name
      data.customer_email = formData.customer_email
      data.customer_phone = formData.customer_phone || null
    }

    try {
      await onSubmit?.(data)
      onClose()
    } catch (error) {
      console.error('Failed to create appointment:', error)
    }
  }

  if (!isOpen) return null

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
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-[var(--bg-primary)] border-l border-[var(--border)] shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {initialData ? 'Edit Appointment' : 'New Appointment'}
              </h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                {initialData ? 'Update appointment details' : 'Schedule a new appointment'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                  placeholder="Customer name"
                />
                {errors.customer_name && (
                  <p className="mt-2 text-sm text-red-400">{errors.customer_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => handleInputChange('customer_email', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                  placeholder="customer@example.com"
                />
                {errors.customer_email && (
                  <p className="mt-2 text-sm text-red-400">{errors.customer_email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-[var(--text-muted)] mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>

          {/* Service Selection */}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-2">Service</label>
            <select
              value={formData.service_id}
              onChange={(e) => handleInputChange('service_id', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
            >
              <option value="">Select a service...</option>
              {services.map(service => (
                <option key={service.service_id} value={service.service_id}>
                  {service.name} {service.duration_minutes ? `(${service.duration_minutes} min)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Date *</label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
              />
              {errors.scheduled_date && (
                <p className="mt-2 text-sm text-red-400">{errors.scheduled_date}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">Time *</label>
              {loadingSlots ? (
                <div className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
                </div>
              ) : (
                <select
                  value={formData.scheduled_time}
                  onChange={(e) => handleInputChange('scheduled_time', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
                >
                  <option value="">Select time...</option>
                  {availableSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              )}
              {errors.scheduled_time && (
                <p className="mt-2 text-sm text-red-400">{errors.scheduled_time}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-2">Initial Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-white focus:border-[var(--gold-primary)] focus:outline-none resize-none"
              placeholder="Add any special requests or notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--gold-primary)] text-black font-medium hover:bg-[var(--gold-primary)]/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {initialData ? 'Update Appointment' : 'Create Appointment'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  )
}