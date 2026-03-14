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
  // Parse selectedDateId as a local date to avoid timezone shifts (e.g., 18 showing as 19)
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
    <div className="min-h-screen pt-16 bg-[#f5f5f7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Book an Appointment</h1>
        <p className="text-sm text-gray-500 mb-10">
          Schedule your guitar service at one of our locations
        </p>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1.2fr_1.2fr_1.05fr] gap-8">
          {/* Services selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Select Services</h2>
            {guitarServices.map(service => {
              const Icon = service.icon
              const isSelected = selectedServices.includes(service.id)
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleToggleService(service.id)}
                  className={`w-full p-4 text-left rounded-xl border-2 transition-all bg-white ${
                    isSelected
                      ? 'border-[#d4af37] bg-[#fff7dd]'
                      : 'border-gray-200 hover:border-[#d4af37] hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 w-4 h-4 rounded-[4px] border flex items-center justify-center ${
                        isSelected
                          ? 'border-[#d4af37] bg-[#d4af37]'
                          : 'border-gray-400 bg-transparent'
                      }`}
                    >
                      {isSelected && <span className="w-2 h-2 bg-white rounded-[2px]" />}
                    </div>
                    <Icon
                      className={`w-5 h-5 mt-1 flex-shrink-0 ${
                        isSelected ? 'text-[#d4af37]' : 'text-gray-400'
                      }`}
                    />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <span className="text-xs font-semibold text-[#d4af37]">
                          ${service.price}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{service.description}</p>
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
            {/* Date picker with availability */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#d4af37]" />
                Select Date
              </h2>
              <p className="text-xs text-gray-500 mb-2">
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
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-900">
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
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-xs text-gray-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d} className="text-center">
                    {d}
                  </span>
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
                      'flex items-center justify-center h-9 rounded-xl text-sm transition-all border bg-white'

                    if (isUnavailable) {
                      return (
                        <div
                          key={day.id}
                          className={`${base} border-transparent text-gray-300 bg-gray-50`}
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
                            ? 'bg-[#d4af37] text-white border-[#d4af37]'
                            : 'border-gray-200 text-gray-700 hover:border-[#d4af37] hover:bg-[#fff7dd]'
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                        ? 'bg-[#d4af37] text-[#231f20]'
                        : 'bg-gray-100 text-gray-600 hover:text-[#d4af37] border border-gray-200'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Guitar details */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">Guitar Details</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Brand</label>
                  <input
                    type="text"
                    value={guitarDetails.brand}
                    onChange={e => setGuitarDetails({ ...guitarDetails, brand: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    placeholder="Fender, Gibson, Ibanez..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={guitarDetails.model}
                    onChange={e => setGuitarDetails({ ...guitarDetails, model: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    placeholder="Stratocaster, Les Paul..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={guitarDetails.serial}
                    onChange={e => setGuitarDetails({ ...guitarDetails, serial: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    placeholder="Optional for tracking"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Issues / Notes</label>
                <textarea
                  value={guitarDetails.notes}
                  onChange={e => setGuitarDetails({ ...guitarDetails, notes: e.target.value })}
                  className="w-full h-24 px-3 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="space-y-2">
                <label className="block text-xs text-gray-500">Location</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">{currentBranch.address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">{currentBranch.phone}</p>
                </div>
                <div className="flex items-start gap-2">
                  <ClockIcon className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">{currentBranch.hours}</p>
                </div>
              </div>
            </div>

            {/* Booking summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="text-gray-900">{currentBranch.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-900">
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
                  <span className="text-gray-500">Time</span>
                  <span className="text-gray-900">
                    {selectedTime || 'Not selected'}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
                  <span className="block text-gray-500">Services</span>
                  {selectedServices.length ? (
                    <ul className="text-gray-900 text-xs space-y-1">
                      {selectedServices.map(id => {
                        const svc = guitarServices.find(s => s.id === id)
                        return (
                          <li key={id} className="flex justify-between">
                            <span>{svc?.name}</span>
                            <span className="text-[#d4af37]">${svc?.price}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">No services selected</p>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
                  <span className="block text-gray-500">Guitar</span>
                  <p className="text-xs text-gray-900">
                    {guitarDetails.brand || guitarDetails.model
                      ? `${guitarDetails.brand} ${guitarDetails.model}`.trim()
                      : 'No guitar details'}
                  </p>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200 mt-3">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-[#d4af37]">
                    ${totalPrice.toLocaleString()}
                  </span>
                </div>
                {referenceNumber && (
                  <div className="pt-2 text-xs text-gray-500">
                    Reference:&nbsp;
                    <span className="font-mono text-gray-900">{referenceNumber}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!isFormComplete}
                className="w-full mt-4 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-lg font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
            >
              <div className="bg-[var(--surface-dark)] border border-[var(--gold-primary)] rounded-2xl px-10 py-8 text-center max-w-sm mx-4 shadow-2xl">
                <CheckCircle2 className="w-16 h-16 text-[var(--gold-primary)] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Booking Confirmed</h3>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Your appointment has been scheduled successfully.
                </p>
                {referenceNumber && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Reference:&nbsp;
                    <span className="font-mono text-[var(--text-light)]">{referenceNumber}</span>
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
