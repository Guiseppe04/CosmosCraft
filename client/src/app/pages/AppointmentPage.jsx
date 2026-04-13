import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Wrench,
  Paintbrush,
  Settings,
  Sparkles,
  MapPin,
  Phone,
  Clock as ClockIcon,
  Calendar,
  Music,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency.js'

const guitarServices = [
  { id: 'custom-build', name: 'Custom Guitar Build', icon: Music, description: 'Full custom guitar from scratch', price: 350 },
  { id: 'setup', name: 'Setup & Intonation', icon: Settings, description: 'Professional setup and tuning', price: 120 },
  { id: 'refinishing', name: 'Refinishing', icon: Paintbrush, description: 'Custom paint and finish work', price: 260 },
  { id: 'repair', name: 'Repair & Restoration', icon: Wrench, description: 'Expert repair services', price: 180 },
  { id: 'electronics', name: 'Electronics Upgrade', icon: Sparkles, description: 'Pickup and wiring upgrades', price: 140 },
]

const branches = [
  {
    id: 'downtown',
    name: 'Downtown Nashville',
    address: '123 Music Row, Nashville, TN 37203',
    phone: '+1 (615) 123-4567',
    hours: 'Mon-Sat 9:00 AM - 6:00 PM',
  },
  {
    id: 'midtown',
    name: 'Midtown Music Hub',
    address: '456 Broadway Ave, Nashville, TN 37201',
    phone: '+1 (615) 234-5678',
    hours: 'Mon-Sat 10:00 AM - 7:00 PM',
  },
  {
    id: 'southend',
    name: 'South End Studio',
    address: '789 Harmony Blvd, Nashville, TN 37205',
    phone: '+1 (615) 345-6789',
    hours: 'Tue-Sun 11:00 AM - 8:00 PM',
  },
]

function getMonthMatrix(year, month) {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weeks = []
  let currentDay = 1 - firstWeekday

  while (currentDay <= daysInMonth) {
    const week = []
    for (let i = 0; i < 7; i++, currentDay++) {
      const date = new Date(year, month, currentDay)
      const inCurrentMonth = currentDay >= 1 && currentDay <= daysInMonth

      let id = null
      let isAvailable = false

      if (inCurrentMonth) {
        id = date.toISOString().slice(0, 10)
        const isPast = date < today
        const isSunday = date.getDay() === 0
        isAvailable = !isPast && !isSunday
      }

      week.push({
        id,
        dayNumber: inCurrentMonth ? date.getDate() : null,
        inCurrentMonth,
        isAvailable,
      })
    }
    weeks.push(week)
  }

  return weeks
}

export function AppointmentPage() {
  const navigate = useNavigate()

  const today = new Date()

  const [selectedBranchId, setSelectedBranchId] = useState(branches[0].id)
  const [selectedServices, setSelectedServices] = useState([])
  const [selectedDateId, setSelectedDateId] = useState('')
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedTime, setSelectedTime] = useState('')
  const [bookingComplete, setBookingComplete] = useState(false)
  const [guitarDetails, setGuitarDetails] = useState({
    brand: '',
    model: '',
    serial: '',
    notes: '',
  })

  const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

  const currentBranch = branches.find(b => b.id === selectedBranchId)
  const selectedDate = selectedDateId ? new Date(`${selectedDateId}T00:00:00`) : null
  const monthMatrix = getMonthMatrix(currentYear, currentMonth)

  const totalPrice = selectedServices.reduce((sum, id) => {
    const svc = guitarServices.find(s => s.id === id)
    return svc ? sum + svc.price : sum
  }, 0)

  const referenceNumber =
    selectedDate && selectedTime
      ? `CC-${selectedBranchId.toUpperCase()}-${selectedDateId.replace(/-/g, '')}-${selectedTime.replace(/[:\s]/g, '')}`
      : ''

  const isFormComplete =
    selectedServices.length > 0 &&
    selectedDate &&
    selectedTime &&
    guitarDetails.brand &&
    guitarDetails.model &&
    guitarDetails.serial

  const handleToggleService = id => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(svcId => svcId !== id) : [...prev, id],
    )
  }

  const handleSubmit = e => {
    e.preventDefault()
    if (!isFormComplete) return
    setBookingComplete(true)
    setTimeout(() => {
      setBookingComplete(false)
      navigate('/dashboard')
    }, 1500)
  }

  return (
    <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold text-white">Book an Appointment</h1>
        </div>
        <p className="text-sm text-white/50 mb-10">
          Schedule your guitar service at one of our locations
        </p>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1.2fr_1.2fr_1.05fr] gap-8">
          {/* Services selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-white mb-4">Select Services</h2>
            {guitarServices.map(service => {
              const Icon = service.icon
              const isSelected = selectedServices.includes(service.id)
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleToggleService(service.id)}
                  className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-[#d4af37] bg-[#d4af37]/10'
                      : 'border-white/10 bg-theme-surface-deep hover:border-[#d4af37]/50 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 w-4 h-4 rounded-[4px] border flex items-center justify-center ${
                        isSelected
                          ? 'border-[#d4af37] bg-[#d4af37]'
                          : 'border-white/30 bg-transparent'
                      }`}
                    >
                      {isSelected && <span className="w-2 h-2 bg-white rounded-[2px]" />}
                    </div>
                    <Icon
                      className={`w-5 h-5 mt-1 flex-shrink-0 ${
                        isSelected ? 'text-[#d4af37]' : 'text-white/30'
                      }`}
                    />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white">{service.name}</h3>
                        <span className="text-xs font-semibold text-[#d4af37]">
                          {formatCurrency(service.price, true)}
                        </span>
                      </div>
                      <p className="text-xs text-white/40">{service.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </motion.div>

          {/* Date / time / guitar details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Date picker */}
            <div className="bg-theme-surface-deep border border-white/10 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#d4af37]" />
                Select Date
              </h2>
              <p className="text-xs text-white/40 mb-2">
                Available dates are interactive; unavailable dates are dimmed.
              </p>

              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(currentYear, currentMonth - 1, 1)
                    setCurrentYear(prev.getFullYear())
                    setCurrentMonth(prev.getMonth())
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-white">
                  {new Date(currentYear, currentMonth, 1).toLocaleDateString(undefined, {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(currentYear, currentMonth + 1, 1)
                    setCurrentYear(next.getFullYear())
                    setCurrentMonth(next.getMonth())
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-xs text-white/30 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d} className="text-center">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthMatrix.map((week, wIdx) =>
                  week.map((day, dIdx) => {
                    if (!day.inCurrentMonth) {
                      return <div key={`${wIdx}-${dIdx}`} className="h-9" />
                    }

                    const isSelected = selectedDateId === day.id
                    const isUnavailable = !day.isAvailable

                    const base =
                      'flex items-center justify-center h-9 rounded-xl text-sm transition-all border'

                    if (isUnavailable) {
                      return (
                        <div
                          key={day.id}
                          className={`${base} border-transparent text-white/20 bg-white/5`}
                        >
                          {day.dayNumber}
                        </div>
                      )
                    }

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setSelectedDateId(day.id)}
                        className={`${base} ${
                          isSelected
                            ? 'bg-[#d4af37] text-[#111111] border-[#d4af37] font-semibold'
                            : 'border-white/10 text-white/70 hover:border-[#d4af37] hover:bg-[#d4af37]/10 hover:text-[#d4af37]'
                        }`}
                      >
                        {day.dayNumber}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>

            {/* Time slots */}
            <div className="bg-theme-surface-deep border border-white/10 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-[#d4af37]" />
                Select Time
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={`py-2 rounded-lg transition-all font-semibold ${
                      selectedTime === time
                        ? 'bg-[#d4af37] text-[#111111]'
                        : 'bg-white/5 text-white/50 hover:text-[#d4af37] border border-white/10 hover:border-[#d4af37]/50'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Guitar details */}
            <div className="bg-theme-surface-deep border border-white/10 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-white">Guitar Details</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Brand</label>
                  <input
                    type="text"
                    value={guitarDetails.brand}
                    onChange={e => setGuitarDetails({ ...guitarDetails, brand: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)] placeholder:text-[var(--text-muted)]"
                    placeholder="Fender, Gibson, Ibanez..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Model</label>
                  <input
                    type="text"
                    value={guitarDetails.model}
                    onChange={e => setGuitarDetails({ ...guitarDetails, model: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)] placeholder:text-[var(--text-muted)]"
                    placeholder="Stratocaster, Les Paul..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={guitarDetails.serial}
                    onChange={e => setGuitarDetails({ ...guitarDetails, serial: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)] placeholder:text-[var(--text-muted)]"
                    placeholder="Optional for tracking"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Issues / Notes</label>
                <textarea
                  value={guitarDetails.notes}
                  onChange={e => setGuitarDetails({ ...guitarDetails, notes: e.target.value })}
                  className="w-full h-24 px-3 py-2.5 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)] placeholder:text-[var(--text-muted)]"
                  placeholder="Describe any issues, upgrades, or preferences..."
                />
              </div>
            </div>
          </motion.div>

          {/* Location + summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-theme-surface-deep border border-white/10 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="space-y-2">
                <label className="block text-xs text-white/40">Location</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:border-[var(--gold-primary)]"
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/60">{currentBranch.address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/60">{currentBranch.phone}</p>
                </div>
                <div className="flex items-start gap-2">
                  <ClockIcon className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-white/60">{currentBranch.hours}</p>
                </div>
              </div>
            </div>

            {/* Booking summary */}
            <div className="bg-theme-surface-deep border border-white/10 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-white mb-2">Booking Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Location</span>
                  <span className="text-white">{currentBranch.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Date</span>
                  <span className="text-white">
                    {selectedDate
                      ? selectedDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Not selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Time</span>
                  <span className="text-white">{selectedTime || 'Not selected'}</span>
                </div>
                <div className="border-t border-white/10 pt-3 mt-3 space-y-1">
                  <span className="block text-white/40">Services</span>
                  {selectedServices.length ? (
                    <ul className="text-white text-xs space-y-1">
                      {selectedServices.map(id => {
                        const svc = guitarServices.find(s => s.id === id)
                        return (
                          <li key={id} className="flex justify-between">
                            <span>{svc?.name}</span>
                            <span className="text-[#d4af37]">{formatCurrency(svc?.price || 0, true)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-white/30">No services selected</p>
                  )}
                </div>
                <div className="border-t border-white/10 pt-3 mt-3 space-y-1">
                  <span className="block text-white/40">Guitar</span>
                  <p className="text-xs text-white">
                    {guitarDetails.brand || guitarDetails.model
                      ? `${guitarDetails.brand} ${guitarDetails.model}`.trim()
                      : 'No guitar details'}
                  </p>
                </div>
                <div className="flex justify-between pt-3 border-t border-white/10 mt-3">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-lg font-bold text-[#d4af37]">
                    {formatCurrency(totalPrice, true)}
                  </span>
                </div>
                {referenceNumber && (
                  <div className="pt-2 text-xs text-white/40">
                    Reference:&nbsp;
                    <span className="font-mono text-white">{referenceNumber}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormComplete}
                className="w-full mt-4 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[#111111] rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Booking &amp; Go to Dashboard
              </button>
            </div>
          </motion.div>
        </form>

        <AnimatePresence>
          {bookingComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/60"
            >
              <div className="bg-theme-surface-deep border border-[#d4af37] rounded-2xl px-10 py-8 text-center max-w-sm mx-4 shadow-2xl">
                <CheckCircle2 className="w-16 h-16 text-[#d4af37] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Booking Confirmed</h3>
                <p className="text-sm text-white/50 mb-3">
                  Your appointment has been scheduled successfully.
                </p>
                {referenceNumber && (
                  <p className="text-xs text-white/40">
                    Reference:&nbsp;
                    <span className="font-mono text-white">{referenceNumber}</span>
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}