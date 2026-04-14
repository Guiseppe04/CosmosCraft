import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { API } from '../utils/apiConfig'
import {
  Wrench,
  Paintbrush,
  Settings,
  Sparkles,
  MapPin,
  Phone,
  Clock as ClockIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Check,
} from 'lucide-react'

// --- CONSTANTS & DATA ---

const guitarServices = [
  {
    categoryId: 'setup',
    name: 'Setup & Intonation',
    icon: Settings,
    options: [
      { id: 'setup-standard', name: 'Standard Setup', leadTime: 3, price: 80, desc: 'Complete intonation, action, and neck adjustment. (1-3 days)' },
      { id: 'setup-full', name: 'Full Setup', leadTime: 7, price: 120, desc: 'Includes fret polishing and deep cleaning. (up to 7 days)' },
    ]
  },
  {
    categoryId: 'refinishing',
    name: 'Refinishing',
    icon: Paintbrush,
    options: [
      { id: 'refinish-basic', name: 'Basic Refinish', leadTime: 21, price: 300, desc: 'Standard solid color. (2-3 weeks)' },
      { id: 'refinish-custom', name: 'Custom Refinish', leadTime: 42, price: 500, desc: 'Burst, metallic, or custom art. (4-6+ weeks)' },
    ]
  },
  {
    categoryId: 'repair',
    name: 'Repair & Restoration',
    icon: Wrench,
    options: [
      { id: 'repair-minor', name: 'Minor Repairs', leadTime: 0, price: 40, desc: 'String replacement, minor wiring fix. (Same day)' },
      { id: 'repair-moderate', name: 'Moderate Repairs', leadTime: 7, price: 150, desc: 'Fret leveling, nut replacement. (2-7 days)' },
      { id: 'repair-major', name: 'Major Repairs', leadTime: 21, price: 350, desc: 'Structural fix, headstock repair. (1-3 weeks or more)' },
    ]
  },
  {
    categoryId: 'electronics',
    name: 'Electronics Upgrade',
    icon: Sparkles,
    options: [
      { id: 'elec-simple', name: 'Simple Upgrade', leadTime: 0, price: 60, desc: 'Pots, output jack, capacitors. (Same day)' },
      { id: 'elec-moderate', name: 'Moderate Upgrade', leadTime: 3, price: 120, desc: 'Pickup installation, wiring cleanup. (1-3 days)' },
      { id: 'elec-advanced', name: 'Advanced Mods', leadTime: 7, price: 200, desc: 'Coil-splitting, custom wiring, shielding. (3-7 days)' },
    ]
  }
]

const APPOINTMENT_BRANCH_STORAGE_KEY = 'cosmoscraft.appointment.branch'
const DEFAULT_BRANCH = {
  id: 'balagtas-main',
  name: 'CosmosCraft Balagtas Branch',
  address: 'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan',
  phone: '+63 000 000 0000',
  hours: 'Mon-Sat 9:00 AM - 6:00 PM',
}

function getAppointmentBranch() {
  if (typeof window === 'undefined') return DEFAULT_BRANCH

  try {
    const raw = window.localStorage.getItem(APPOINTMENT_BRANCH_STORAGE_KEY)
    if (!raw) return DEFAULT_BRANCH
    const parsed = JSON.parse(raw)

    return {
      ...DEFAULT_BRANCH,
      ...parsed,
      id: parsed?.id || DEFAULT_BRANCH.id,
      name: parsed?.name || DEFAULT_BRANCH.name,
      address: parsed?.address || DEFAULT_BRANCH.address,
    }
  } catch {
    return DEFAULT_BRANCH
  }
}

const STEPS = [
  { id: 1, label: 'Service' },
  { id: 2, label: 'Guitar Details' },
  { id: 3, label: 'Location' },
  { id: 4, label: 'Appointment' },
  { id: 5, label: 'Confirmation' },
]

// --- UTILS ---

function getMonthMatrix(year, month, maxLeadTimeDays) {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const minAvailableDate = new Date(today)
  minAvailableDate.setDate(today.getDate() + maxLeadTimeDays)

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
        const isPast = date < minAvailableDate
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

// --- COMPONENT ---

export function AppointmentPage() {
  const navigate = useNavigate()
  const today = new Date()
  const branch = useMemo(() => getAppointmentBranch(), [])
  const branches = useMemo(() => [branch], [branch])

  // State
  const [currentStep, setCurrentStep] = useState(1)
  
  // Selections
  const [selectedServicesByCategory, setSelectedServicesByCategory] = useState({})
  const [guitarDetails, setGuitarDetails] = useState({ brand: '', model: '', serial: '', notes: '' })
  const [selectedBranchId] = useState(branches[0].id)
  const [selectedDateId, setSelectedDateId] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [bookingComplete, setBookingComplete] = useState(false)

  const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM']

  const currentBranch = branches.find(b => b.id === selectedBranchId)
  const selectedDate = selectedDateId ? new Date(`${selectedDateId}T00:00:00`) : null

  const selectedServices = useMemo(
    () => Object.values(selectedServicesByCategory).filter(Boolean),
    [selectedServicesByCategory]
  )

  // Derived calculations
  const { maxLeadTime, totalPrice, selectedDetailedServices } = useMemo(() => {
    let lead = 0
    let price = 0
    let details = []

    selectedServices.forEach(selectedId => {
      for (const cat of guitarServices) {
        const opt = cat.options.find(o => o.id === selectedId)
        if (opt) {
          lead = Math.max(lead, opt.leadTime)
          price += opt.price
          details.push(opt)
        }
      }
    })
    return { maxLeadTime: lead, totalPrice: price, selectedDetailedServices: details }
  }, [selectedServices])

  const monthMatrix = useMemo(() => getMonthMatrix(currentYear, currentMonth, maxLeadTime), [currentYear, currentMonth, maxLeadTime])

  const referenceNumber = selectedDate && selectedTime
    ? `CC-${selectedBranchId.toUpperCase()}-${selectedDateId.replace(/-/g, '')}-${selectedTime.replace(/[:\s]/g, '')}`
    : ''

  // Validation
  const canProceed = () => {
    if (currentStep === 1) return selectedServices.length > 0
    if (currentStep === 2) return guitarDetails.brand.trim() && guitarDetails.model.trim() && guitarDetails.serial.trim()
    if (currentStep === 3) return !!selectedBranchId
    if (currentStep === 4) return selectedDateId && selectedTime
    return true
  }

  // Handlers
  const handleToggleService = (categoryId, optId) => {
    setSelectedServicesByCategory(prev => ({
      ...prev,
      [categoryId]: prev[categoryId] === optId ? null : optId
    }))
  }

  const handleNextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(s => s + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(s => s - 1)
    }
  }

  const handleSubmit = async () => {
    if (!canProceed()) return
    setBookingComplete(true)
    
    try {
      const [timeStr, modifier] = selectedTime.split(' ');
      let [hours, minutes] = timeStr.split(':');
      if (hours === '12') hours = '00';
      if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
      const scheduledAt = new Date(`${selectedDateId}T${hours.toString().padStart(2, '0')}:${minutes}:00`);

      const response = await fetch(`${API}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          appointment_type: 'service_in_shop',
          services: selectedServices,
          location_id: selectedBranchId,
          guitar_details: {
            brand: guitarDetails.brand,
            model: guitarDetails.model,
            serial: guitarDetails.serial,
            notes: guitarDetails.notes || ''
          },
          scheduled_at: scheduledAt.toISOString(),
          notes: guitarDetails.notes || ''
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create appointment');
      }

      setTimeout(() => {
        setBookingComplete(false)
        navigate('/dashboard')
      }, 2000)

    } catch (error) {
      console.error('Submission Error:', error);
      setBookingComplete(false);
      alert(`Failed to book appointment: ${error.message}`);
    }
  }

  // --- RENDERS ---

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Select Services</h2>
              <p className="text-sm text-[var(--text-muted)]">Choose one or more professional guitar services. Our calendar availability will automatically adjust based on the expected turnaround times.</p>
            </div>
            
            <div className="space-y-6">
              {guitarServices.map(category => (
                <div key={category.categoryId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <category.icon className="w-5 h-5 text-[#d4af37]" />
                    <h3 className="font-semibold text-[var(--text-light)]">{category.name}</h3>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 pl-7">
                    {category.options.map(option => {
                      const isSelected = selectedServicesByCategory[category.categoryId] === option.id
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleToggleService(category.categoryId, option.id)}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            isSelected 
                              ? 'border-[#d4af37] bg-[#d4af37]/10' 
                              : 'border-[var(--border)] bg-theme-surface-deep hover:border-[#d4af37]/30 hover:bg-[var(--surface-elevated)]'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-semibold text-sm ${isSelected ? 'text-[#d4af37]' : 'text-[var(--text-light)]'}`}>
                              {option.name}
                            </span>
                            <span className="text-sm font-bold text-[var(--text-muted)]">₱{option.price}</span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{option.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )

      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Guitar Details</h2>
              <p className="text-sm text-[var(--text-muted)]">Tell us about the instrument you're bringing in.</p>
            </div>
            
            <div className="bg-theme-surface-deep border border-[var(--border)] p-6 rounded-2xl space-y-5">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Brand <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={guitarDetails.brand}
                  onChange={e => setGuitarDetails({ ...guitarDetails, brand: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="e.g. Fender, Gibson, Ibanez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Model <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={guitarDetails.model}
                  onChange={e => setGuitarDetails({ ...guitarDetails, model: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="e.g. Stratocaster, Les Paul"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Serial Number <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={guitarDetails.serial}
                  onChange={e => setGuitarDetails({ ...guitarDetails, serial: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="Required for shop tracking and liability"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Issues & Notes</label>
                <textarea
                  value={guitarDetails.notes}
                  onChange={e => setGuitarDetails({ ...guitarDetails, notes: e.target.value })}
                  className="w-full h-32 px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:border-[#d4af37] transition-colors placeholder:text-[var(--text-muted)]"
                  placeholder="Describe your requested setups, string gauge preferences, or structural issues..."
                />
              </div>
            </div>
          </motion.div>
        )

      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
             <div>
              <h2 className="text-2xl font-bold text-white mb-2">Location</h2>
              <p className="text-sm text-[var(--text-muted)]">Appointments are currently available at our Balagtas branch.</p>
            </div>

            <div className="space-y-3">
              {branches.map(branch => {
                const isSelected = selectedBranchId === branch.id
                return (
                  <div
                    key={branch.id}
                    className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-[#d4af37] bg-[#d4af37]/5"
                  >
                    <div className="flex gap-4 text-left">
                      <div className="p-3 rounded-full bg-[#d4af37]/20 text-[#d4af37]">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg mb-1 text-[var(--text-light)]">{branch.name}</h3>
                        <p className="text-sm text-[var(--text-muted)]">{branch.address}</p>
                        <p className="text-sm text-[var(--text-muted)] mt-1">{branch.hours}</p>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-6 h-6 text-[#d4af37]" />}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )

      case 4:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
               <h2 className="text-2xl font-bold text-white mb-2">Select Date and Time</h2>
               <p className="text-sm text-[var(--text-muted)]">Due to current service volumes and your selected turnaround times, unavailable dates have been disabled.</p>
             </div>

            <div className="bg-theme-surface-deep border border-[var(--border)] rounded-2xl p-6 shadow-xl">
              {/* Calendar header */}
               <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-bold text-[var(--text-light)]">
                  {new Date(currentYear, currentMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const prev = new Date(currentYear, currentMonth - 1, 1)
                      setCurrentYear(prev.getFullYear())
                      setCurrentMonth(prev.getMonth())
                    }}
                    className="p-2 rounded-lg bg-[var(--surface-dark)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors border border-[var(--border)]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const next = new Date(currentYear, currentMonth + 1, 1)
                      setCurrentYear(next.getFullYear())
                      setCurrentMonth(next.getMonth())
                    }}
                    className="p-2 rounded-lg bg-[var(--surface-dark)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors border border-[var(--border)]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 text-sm text-[var(--text-muted)] mb-3 font-medium">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d} className="text-center pb-2">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2 mb-8">
                {monthMatrix.map((week, wIdx) =>
                  week.map((day, dIdx) => {
                    if (!day.inCurrentMonth) return <div key={`empty-${wIdx}-${dIdx}`} className="h-10" />

                    const isSelected = selectedDateId === day.id
                    const isUnavailable = !day.isAvailable

                    if (isUnavailable) {
                      return (
                        <div key={day.id} className="flex items-center justify-center h-10 rounded-xl text-sm font-medium text-[var(--text-muted)] bg-[var(--surface-elevated)] cursor-not-allowed">
                          {day.dayNumber}
                        </div>
                      )
                    }

                    return (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDateId(day.id)}
                        className={`flex items-center justify-center h-10 rounded-xl text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-105'
                            : 'bg-[var(--surface-dark)] text-[var(--text-light)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[#d4af37]/30'
                        }`}
                      >
                        {day.dayNumber}
                      </button>
                    )
                  })
                )}
              </div>

              {/* Time Slots */}
              {selectedDateId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 border-t border-[var(--border)]">
                  <h3 className="text-sm font-bold text-[var(--text-muted)] mb-4 uppercase tracking-wider">Available Time Slots</h3>
                  <div className="flex flex-wrap gap-3">
                    {timeSlots.map(time => {
                      const isSelected = selectedTime === time
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#d4af37] text-black'
                              : 'bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] hover:border-[#d4af37]/30'
                          }`}
                        >
                          {time}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Currently Selected Summary */}
            <div className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${selectedDateId && selectedTime ? 'bg-[#d4af37]/10 border-[#d4af37]/30' : 'bg-theme-surface-deep border-[var(--border)]'}`}>
               <ClockIcon className={`w-5 h-5 ${selectedDateId && selectedTime ? 'text-[#d4af37]' : 'text-[var(--text-muted)]'}`} />
               <div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">Currently Selected</p>
                  <p className={`text-sm font-medium ${selectedDateId && selectedTime ? 'text-[#d4af37]' : 'text-[var(--text-muted)]'}`}>
                    {selectedDate && selectedTime 
                        ? `${selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${selectedTime}`
                        : 'No date and time selected yet'}
                  </p>
               </div>
            </div>
          </motion.div>
        )

      case 5:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Confirmation</h2>
              <p className="text-sm text-[var(--text-muted)]">Review your appointment details before finalizing.</p>
            </div>

            <div className="bg-theme-surface-deep border border-[var(--border)] rounded-2xl p-6 shadow-xl space-y-6">
               <div className="flex justify-between items-end border-b border-[var(--border)] pb-4">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Appointment Date</p>
                    <p className="text-lg font-medium text-[#d4af37]">
                      {selectedDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})} at {selectedTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Location</p>
                    <p className="text-sm font-medium text-[var(--text-light)]">{currentBranch.name}</p>
                  </div>
               </div>
               
               <div className="grid sm:grid-cols-2 gap-6">
                 <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Selected Services</p>
                    <ul className="space-y-2">
                      {selectedDetailedServices.map(svc => (
                        <li key={svc.id} className="flex justify-between text-sm">
                          <span className="text-[var(--text-light)]">{svc.name}</span>
                          <span className="text-[#d4af37]">₱{svc.price}</span>
                        </li>
                      ))}
                    </ul>
                 </div>
                 
                 <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Guitar Details</p>
                    <div className="space-y-1 text-sm bg-[var(--surface-dark)] p-3 rounded-lg border border-[var(--border)]">
                      <p><span className="text-[var(--text-muted)]">Brand:</span> <span className="text-[var(--text-light)]">{guitarDetails.brand}</span></p>
                      <p><span className="text-[var(--text-muted)]">Model:</span> <span className="text-[var(--text-light)]">{guitarDetails.model}</span></p>
                      <p><span className="text-[var(--text-muted)]">Serial:</span> <span className="text-[var(--text-light)]">{guitarDetails.serial}</span></p>
                    </div>
                 </div>
               </div>

               <div className="border-t border-[var(--border)] pt-4 flex justify-between items-center">
                  <span className="text-sm font-bold text-[var(--text-muted)] uppercase">Estimated Total</span>
                  <span className="text-2xl font-bold text-[#d4af37]">₱{totalPrice}</span>
               </div>
               
               {referenceNumber && (
                 <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg p-3 text-center">
                   <p className="text-xs text-[#d4af37]/80 uppercase tracking-wider mb-1">Temporary Reference Number</p>
                   <p className="font-mono font-bold text-[#d4af37]">{referenceNumber}</p>
                 </div>
               )}
            </div>
          </motion.div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors mb-8 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium text-sm">Back to Dashboard</span>
        </button>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8 xl:gap-12 min-h-[600px]">
          
          {/* LEFT SIDEBAR (STEPPER) */}
          <div className="bg-theme-surface-deep border border-[var(--border)] rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between">
             {/* Gradient splash mimicking reference */}
             <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#d4af37]/10 blur-[100px] rounded-full pointer-events-none" />
             <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#d4af37]/5 blur-[100px] rounded-full pointer-events-none" />
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-12">
                   {/* Logo mock */}
                   <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#8a7223] flex items-center justify-center">
                      <Settings className="w-5 h-5 text-black" />
                   </div>
                   <span className="font-bold tracking-wider text-[var(--text-light)] text-lg">Cosmos<span className="font-light">Craft</span></span>
                </div>

                <div className="space-y-6 relative ml-2">
                  {/* Vertical connecting line */}
                  <div className="absolute left-[13px] top-4 bottom-8 w-[2px] bg-[var(--border)] -z-10" />

                  {STEPS.map(step => {
                    const isCompleted = currentStep > step.id
                    const isCurrent = currentStep === step.id
                    const isUpcoming = currentStep < step.id

                    return (
                      <div key={step.id} className="flex items-center gap-4 relative">
                        {/* Step Marker */}
                        <div 
                          className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            isCompleted 
                              ? 'bg-[#d4af37] text-black border border-[#d4af37]' 
                              : isCurrent 
                                ? 'bg-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)] border border-[#d4af37]'
                                : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border border-[var(--border)]'
                          }`}
                        >
                          {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                        </div>
                        {/* Step Label */}
                        <span className={`text-sm font-medium transition-colors ${
                          isCurrent ? 'text-[var(--text-light)]' : isCompleted ? 'text-[var(--text-light)]/70' : 'text-[var(--text-muted)]'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
             </div>

             <div className="relative z-10 mt-12 text-center text-xs text-[var(--text-muted)]">
               Need help with booking?<br/>Contact our support
             </div>
          </div>

          {/* RIGHT CONTENT PANE */}
          <div className="flex flex-col relative">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div key={currentStep}>
                  {renderStepContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pagination Controls */}
            <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center justify-between">
               <button
                 onClick={handlePrevStep}
                 disabled={currentStep === 1 || bookingComplete}
                 className="px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--text-light)] bg-[var(--surface-dark)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors disabled:opacity-0"
               >
                 Back
               </button>

               {currentStep < 5 ? (
                 <button
                   onClick={handleNextStep}
                   disabled={!canProceed()}
                   className="px-8 py-2.5 rounded-xl text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#d4af37]/10"
                 >
                   Next {currentStep === 4 && 'Step'}
                 </button>
               ) : (
                 <button
                   onClick={handleSubmit}
                   disabled={bookingComplete}
                   className="px-8 py-2.5 rounded-xl text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] shadow-[#d4af37]/20 flex items-center gap-2"
                 >
                   {bookingComplete ? (
                     <>Processing... <Settings className="w-4 h-4 animate-spin" /></>
                   ) : (
                     "Complete Booking"
                   )}
                 </button>
               )}
            </div>
          </div>

        </div>

        {/* Global Success Overlay */}
        <AnimatePresence>
          {bookingComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm"
            >
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#181818] border border-[#d4af37]/50 rounded-3xl p-10 text-center max-w-sm mx-4 shadow-2xl">
                <div className="w-20 h-20 bg-[#d4af37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-[#d4af37]" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-light)] mb-2">Booking Confirmed!</h3>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Your appointment has been scheduled successfully. You will be redirected to the dashboard.
                </p>
                {referenceNumber && (
                   <p className="text-xs font-mono text-[#d4af37] bg-[#d4af37]/10 py-2 rounded-lg">
                     {referenceNumber}
                   </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
