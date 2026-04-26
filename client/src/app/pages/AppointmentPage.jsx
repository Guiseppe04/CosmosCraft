import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { API } from '../utils/apiConfig'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Wrench,
  Paintbrush,
  Settings,
  Sparkles,
  MapPin,
  Clock as ClockIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Check,
  ImagePlus,
  X,
} from 'lucide-react'

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
  { id: 1, label: 'Appointment' },
  { id: 2, label: 'Service' },
  { id: 3, label: 'Guitar & Service Type' },
  { id: 4, label: 'Location' },
  { id: 5, label: 'Confirmation' },
]

const SERVICE_CATEGORY_META = {
  setup: {
    name: 'Setup & Intonation',
    icon: Settings,
    order: 1,
  },
  refinishing: {
    name: 'Refinishing',
    icon: Paintbrush,
    order: 2,
  },
  repair: {
    name: 'Repair & Restoration',
    icon: Wrench,
    order: 3,
  },
  electronics: {
    name: 'Electronics Upgrade',
    icon: Sparkles,
    order: 4,
  },
}

// --- HOLIDAYS ---
const HOLIDAYS = [
  // Format: 'MM-DD' (month-day)
  '01-01', // New Year's Day
  '04-02', // Maundy Thursday
  '04-03', // Good Friday
  '04-09', // Araw ng Kagitingan
  '05-01', // Labor Day
  '06-12', // Independence Day
  '08-31', // National Heroes Day
  '11-30', // Bonifacio Day
  '12-25', // Christmas Day
  '12-30', // Rizal Day
]

const OPENING_YEAR = 2026
const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const APPOINTMENT_GUITAR_TYPES = ['electric', 'bass', 'acoustic', 'ukulele']

// --- UTILS ---

function isHoliday(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return HOLIDAYS.includes(`${month}-${day}`)
}

function inferServiceIcon(service = {}) {
  const haystack = `${service.name || ''} ${service.description || ''}`.toLowerCase()
  if (haystack.includes('refinish') || haystack.includes('paint') || haystack.includes('burst') || haystack.includes('color')) return Paintbrush
  if (haystack.includes('electronic') || haystack.includes('pickup') || haystack.includes('wiring') || haystack.includes('mod')) return Sparkles
  if (haystack.includes('setup') || haystack.includes('intonation') || haystack.includes('action') || haystack.includes('neck')) return Settings
  return Wrench
}

function inferLeadTimeDays(service = {}) {
  if (Number.isFinite(Number(service.lead_time_days))) {
    return Number(service.lead_time_days)
  }

  const description = String(service.description || '').toLowerCase()
  if (!description) return 0
  if (description.includes('same day')) return 0

  const dayRangeMatch = description.match(/(\d+)\s*-\s*(\d+)\s*days?/)
  if (dayRangeMatch) return Number(dayRangeMatch[2]) || 0

  const upToDayMatch = description.match(/up to\s*(\d+)\s*days?/)
  if (upToDayMatch) return Number(upToDayMatch[1]) || 0

  const singleDayMatch = description.match(/(\d+)\s*days?/)
  if (singleDayMatch) return Number(singleDayMatch[1]) || 0

  const weekRangeMatch = description.match(/(\d+)\s*-\s*(\d+)\s*\+?\s*weeks?/)
  if (weekRangeMatch) return (Number(weekRangeMatch[2]) || 0) * 7

  const singleWeekMatch = description.match(/(\d+)\s*\+?\s*weeks?/)
  if (singleWeekMatch) return (Number(singleWeekMatch[1]) || 0) * 7

  return 0
}

function formatLeadTimeLabel(service = {}) {
  const leadTimeDays = inferLeadTimeDays(service)
  if (leadTimeDays <= 0) return 'Same day turnaround'
  return `Up to ${leadTimeDays} day${leadTimeDays > 1 ? 's' : ''} turnaround`
}

function formatLocalDateId(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeAppointmentGuitarType(value = '') {
  return String(value || '').trim().toLowerCase()
}

function formatAppointmentGuitarTypeLabel(value = '') {
  const normalized = normalizeAppointmentGuitarType(value)
  if (!normalized) return '—'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getMonthMatrix(year, month, maxLeadTimeDays, disabledDateSet = new Set()) {
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
      let isHolidayDate = false

      if (inCurrentMonth) {
        id = formatLocalDateId(date)
        const isPast = date < today
        const isTooSoon = date < minAvailableDate
        const isSunday = date.getDay() === 0
        isHolidayDate = isHoliday(date)
        const isAdminDisabled = disabledDateSet.has(id)
        isAvailable = !isPast && !isTooSoon && !isSunday && !isHolidayDate && !isAdminDisabled
      }

      week.push({
        id,
        dayNumber: inCurrentMonth ? date.getDate() : null,
        inCurrentMonth,
        isAvailable,
        isHolidayDate,
        isPastDate: inCurrentMonth ? date < today : false,
      })
    }
    weeks.push(week)
  }

  return weeks
}

// --- COMPONENT ---

export function AppointmentPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoadingUser, openLogin } = useAuth()
  const today = new Date()
  const branch = useMemo(() => getAppointmentBranch(), [])
  const branches = useMemo(() => [branch], [branch])
  const userAddresses = Array.isArray(user?.addresses) ? user.addresses : []
  const savedBuilds = useMemo(() => {
    if (typeof window === 'undefined') return []
    const savedGuitarBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]').map((build) => ({ ...build, isBass: false }))
    const savedBassBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').map((build) => ({ ...build, isBass: true }))
    return [...savedGuitarBuilds, ...savedBassBuilds]
  }, [])

  // State
  const [currentStep, setCurrentStep] = useState(1)
  
  // Selections
  const [guitarSelectionMode, setGuitarSelectionMode] = useState(savedBuilds.length > 0 ? 'saved' : 'manual')
  const [selectedSavedBuildId, setSelectedSavedBuildId] = useState('')
  const [manualGuitars, setManualGuitars] = useState([])
  const [homeServiceOption, setHomeServiceOption] = useState('')
  const [homeServiceAddressId, setHomeServiceAddressId] = useState('')
  const [homeServiceContact, setHomeServiceContact] = useState(user?.phone || '')
  const [availableServices, setAvailableServices] = useState([])
  const [servicesError, setServicesError] = useState('')
  const [servicesLoading, setServicesLoading] = useState(true)
  const [selectedServicesByCategory, setSelectedServicesByCategory] = useState({})
  const [guitarDetails, setGuitarDetails] = useState({ brand: '', model: '', type: 'electric', serial: '', notes: '' })
  const [serviceReferenceFile, setServiceReferenceFile] = useState(null)
  const [serviceReferencePreviewUrl, setServiceReferencePreviewUrl] = useState('')
  const [guitarReferenceFile, setGuitarReferenceFile] = useState(null)
  const [guitarReferencePreviewUrl, setGuitarReferencePreviewUrl] = useState('')
  const [selectedBranchId] = useState(branches[0].id)
  const [selectedDateId, setSelectedDateId] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [unavailableDateSet, setUnavailableDateSet] = useState(new Set())
  const [availableTimeSet, setAvailableTimeSet] = useState(new Set())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotAvailabilityStatus, setSlotAvailabilityStatus] = useState('')
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)

  const timeSlots = useMemo(
    () => ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'],
    []
  )

  const currentBranch = branches.find(b => b.id === selectedBranchId)
  const selectedDate = selectedDateId ? new Date(`${selectedDateId}T00:00:00`) : null

  const selectedAppointmentType = homeServiceOption === 'yes' ? 'service_home' : homeServiceOption === 'no' ? 'service_in_shop' : ''
  const hasManualGuitarDetails = Boolean(
    guitarDetails.brand.trim()
    && guitarDetails.model.trim()
    && normalizeAppointmentGuitarType(guitarDetails.type)
  )
  const selectedSavedBuilds = useMemo(
    () => savedBuilds.filter((build) => String(build.id) === String(selectedSavedBuildId)),
    [selectedSavedBuildId, savedBuilds]
  )
  const selectedGuitarEntries = useMemo(() => {
    if (guitarSelectionMode === 'saved') {
      return selectedSavedBuilds.map((build) => ({
        brand: build.name || 'Saved Build',
        model: build.summary?.body || build.config?.body || build.config?.bassType || 'Custom Build',
        type: normalizeAppointmentGuitarType(build.isBass ? 'bass' : (build.config?.guitarType || 'electric')),
        serial: 'N/A',
        notes: build.summary
          ? `Saved build details: ${Object.values(build.summary).filter(Boolean).join(', ')}`
          : '',
      }))
    }

    return manualGuitars
  }, [guitarSelectionMode, manualGuitars, selectedSavedBuilds])
  const hasSelectedGuitar = selectedGuitarEntries.length > 0
  const selectedServices = useMemo(
    () => Object.values(selectedServicesByCategory).filter(Boolean),
    [selectedServicesByCategory]
  )

  useEffect(() => {
    let isMounted = true

    const loadServices = async () => {
      setServicesLoading(true)
      setServicesError('')

      try {
        const response = await fetch(`${API}/api/services?is_active=true&limit=100&sort=name&order=asc`)
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.message || 'Failed to load services')
        }

        if (!isMounted) return
        setAvailableServices(Array.isArray(payload.data) ? payload.data : [])
      } catch (error) {
        if (!isMounted) return
        setServicesError(error.message || 'Failed to load services')
        setAvailableServices([])
      } finally {
        if (isMounted) {
          setServicesLoading(false)
        }
      }
    }

    loadServices()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadUnavailableDates = async () => {
      try {
        const response = await fetch(`${API}/api/appointments/unavailable-dates`, {
          credentials: 'include',
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (!isMounted) return
          setUnavailableDateSet(new Set())
          return
        }

        const dates = Array.isArray(payload?.data?.unavailable_dates) ? payload.data.unavailable_dates : []
        const nextSet = new Set(
          dates
            .map((entry) => String(entry?.date || '').slice(0, 10))
            .filter(Boolean)
        )

        if (isMounted) {
          setUnavailableDateSet(nextSet)
          if (selectedDateId && nextSet.has(selectedDateId)) {
            setSelectedDateId('')
            setSelectedTime('')
          }
        }
      } catch {
        if (isMounted) {
          setUnavailableDateSet(new Set())
        }
      }
    }

    loadUnavailableDates()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadAvailableSlots = async () => {
      if (!selectedDateId || unavailableDateSet.has(selectedDateId)) {
        setAvailableTimeSet(new Set())
        setSlotAvailabilityStatus('')
        return
      }

      const fallbackServiceId = selectedServices[0] || availableServices[0]?.service_id
      if (!fallbackServiceId) {
        setAvailableTimeSet(new Set(timeSlots))
        setSlotAvailabilityStatus('open')
        return
      }

      setSlotsLoading(true)
      try {
        const response = await fetch(
          `${API}/api/appointments/services/${fallbackServiceId}/availability/slots?date=${selectedDateId}&slot_duration=60`,
          { credentials: 'include' }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to load available time slots')
        }

        const backendSlots = Array.isArray(payload?.data?.available_slots) ? payload.data.available_slots : []
        const availabilityStatus = String(payload?.data?.availability_status || (backendSlots.length > 0 ? 'open' : '')).toLowerCase()
        const nextSet = new Set(
          backendSlots
            .map((slot) => {
              if (slot?.formatted_start) return String(slot.formatted_start).toUpperCase()
              if (slot?.start) {
                return new Date(slot.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
              }
              return null
            })
            .filter(Boolean)
        )

        if (!isMounted) return
        setAvailableTimeSet(nextSet)
        setSlotAvailabilityStatus(availabilityStatus)
        if (selectedTime && !nextSet.has(selectedTime.toUpperCase())) {
          setSelectedTime('')
        }
      } catch {
        if (isMounted) {
          const fallbackSet = new Set(timeSlots.map((slot) => slot.toUpperCase()))
          setAvailableTimeSet(fallbackSet)
          setSlotAvailabilityStatus('')
        }
      } finally {
        if (isMounted) {
          setSlotsLoading(false)
        }
      }
    }

    loadAvailableSlots()
    return () => { isMounted = false }
  }, [availableServices, selectedDateId, selectedServices, selectedTime, timeSlots, unavailableDateSet])

  // Derived calculations
  const { maxLeadTime, totalPrice, selectedDetailedServices } = useMemo(() => {
    let lead = 0
    let price = 0
    let details = []

    selectedServices.forEach(selectedId => {
      const service = availableServices.find((item) => String(item.service_id) === String(selectedId))
      if (service) {
        lead = Math.max(lead, inferLeadTimeDays(service))
        price += Number(service.price || 0)
        details.push({
          id: String(service.service_id),
          name: service.name,
          price: Number(service.price || 0),
          desc: service.description || '',
          duration_minutes: Number(service.duration_minutes || 0),
          icon: inferServiceIcon(service),
        })
      }
    })
    return { maxLeadTime: lead, totalPrice: price, selectedDetailedServices: details }
  }, [availableServices, selectedServices])

  const groupedServices = useMemo(() => {
    const groups = new Map()

    availableServices.forEach((service) => {
      const categoryId = String(service.category_id || 'other').trim().toLowerCase() || 'other'
      const meta = SERVICE_CATEGORY_META[categoryId] || {
        name: categoryId
          .split(/[_-]+/)
          .filter(Boolean)
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(' ') || 'Other Services',
        icon: inferServiceIcon(service),
        order: 99,
      }

      if (!groups.has(categoryId)) {
        groups.set(categoryId, {
          categoryId,
          name: meta.name,
          icon: meta.icon,
          order: meta.order,
          services: [],
        })
      }

      groups.get(categoryId).services.push(service)
    })

    return Array.from(groups.values()).sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order
      return left.name.localeCompare(right.name)
    })
  }, [availableServices])

  const monthMatrix = useMemo(
    () => getMonthMatrix(currentYear, currentMonth, maxLeadTime, unavailableDateSet),
    [currentYear, currentMonth, maxLeadTime, unavailableDateSet]
  )

  const referenceNumber = selectedDate && selectedTime
    ? `CC-${selectedBranchId.toUpperCase()}-${selectedDateId.replace(/-/g, '')}-${selectedTime.replace(/[:\s]/g, '')}`
    : ''

  const selectedPrimaryGuitar = selectedGuitarEntries[0] || null

  // Validation
  const canProceed = () => {
    if (currentStep === 1) return selectedDateId && selectedTime
    if (currentStep === 2) return selectedServices.length > 0
    if (currentStep === 3) return Boolean(selectedAppointmentType)
    if (currentStep === 4) {
      if (selectedAppointmentType === 'service_home') {
        return Boolean(homeServiceAddressId && homeServiceContact.trim())
      }
      return !!selectedBranchId
    }
    return true
  }

  const getStepValidationMessage = () => {
    if (currentStep === 1) {
      if (!selectedDateId || !selectedTime) return 'Select both appointment date and time.'
    }
    if (currentStep === 2 && selectedServices.length === 0) {
      return 'Select at least one service to continue.'
    }
    if (currentStep === 3) {
      if (!selectedAppointmentType) return 'Please choose Home Service: Yes or No.'
    }
    if (currentStep === 4 && selectedAppointmentType === 'service_home') {
      if (!homeServiceAddressId) return 'Select your home service address.'
      if (!homeServiceContact.trim()) return 'Enter your contact number for home service.'
    }
    return ''
  }

  // Handlers
  const handleToggleService = (categoryId, serviceId) => {
    const normalizedCategoryId = String(categoryId)
    const normalizedServiceId = String(serviceId)

    setSelectedServicesByCategory((prev) => ({
      ...prev,
      [normalizedCategoryId]: prev[normalizedCategoryId] === normalizedServiceId ? null : normalizedServiceId,
    }))
  }

  const handleAddManualGuitar = () => {
    if (!hasManualGuitarDetails) return

    const nextGuitar = {
      brand: guitarDetails.brand.trim(),
      model: guitarDetails.model.trim(),
      type: normalizeAppointmentGuitarType(guitarDetails.type),
      serial: guitarDetails.serial.trim() || 'N/A',
      notes: guitarDetails.notes.trim(),
    }

    setManualGuitars((prev) => [...prev, nextGuitar])
    setGuitarDetails({ brand: '', model: '', type: 'electric', serial: '', notes: '' })
  }

  const handleRemoveManualGuitar = (indexToRemove) => {
    setManualGuitars((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  const renderServiceOption = (categoryId, service) => {
    const serviceId = String(service.service_id)
    const isSelected = selectedServicesByCategory[categoryId] === serviceId
    const Icon = inferServiceIcon(service)

    return (
      <button
        key={serviceId}
        type="button"
        onClick={() => handleToggleService(categoryId, serviceId)}
        className={`text-left rounded-xl border-2 p-4 transition-all ${
          isSelected
            ? 'border-[#d4af37] bg-[#d4af37]/10'
            : 'border-[var(--border)] bg-theme-surface-deep hover:border-[#d4af37]/30 hover:bg-[var(--surface-elevated)]'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2 ${isSelected ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[var(--surface-dark)] text-[var(--text-muted)]'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <span className={`block text-sm font-semibold ${isSelected ? 'text-[#d4af37]' : 'text-[var(--text-light)]'}`}>
                {service.name}
              </span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                {formatLeadTimeLabel(service)}
              </span>
            </div>
          </div>
          <span className="text-sm font-bold text-[var(--text-muted)]">PHP {Number(service.price || 0).toLocaleString('en-PH')}</span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          {service.description || 'No description available.'}
        </p>
      </button>
    )
  }

  const renderServiceSelection = () => {
    if (servicesLoading) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-theme-surface-deep p-6 text-sm text-[var(--text-muted)]">
          Loading services...
        </div>
      )
    }

    if (servicesError) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          {servicesError}
        </div>
      )
    }

    if (availableServices.length === 0) {
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-theme-surface-deep p-6 text-sm text-[var(--text-muted)]">
          No active services are available right now.
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {groupedServices.map((category) => {
          const CategoryIcon = category.icon

          return (
            <section key={category.categoryId} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#d4af37]/15 p-2 text-[#d4af37]">
                  <CategoryIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-light)]">{category.name}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {category.services.length} service{category.services.length > 1 ? 's' : ''} available
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {category.services.map((service) => renderServiceOption(category.categoryId, service))}
              </div>
            </section>
          )
        })}
      </div>
    )
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

  const handleReferenceImageChange = (target, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      alert('Image size must be 10MB or less.')
      return
    }

    const objectUrl = URL.createObjectURL(file)

    if (target === 'service') {
      if (serviceReferencePreviewUrl) URL.revokeObjectURL(serviceReferencePreviewUrl)
      setServiceReferenceFile(file)
      setServiceReferencePreviewUrl(objectUrl)
      return
    }

    if (guitarReferencePreviewUrl) URL.revokeObjectURL(guitarReferencePreviewUrl)
    setGuitarReferenceFile(file)
    setGuitarReferencePreviewUrl(objectUrl)
  }

  const clearReferenceImage = (target) => {
    if (target === 'service') {
      if (serviceReferencePreviewUrl) URL.revokeObjectURL(serviceReferencePreviewUrl)
      setServiceReferenceFile(null)
      setServiceReferencePreviewUrl('')
      return
    }

    if (guitarReferencePreviewUrl) URL.revokeObjectURL(guitarReferencePreviewUrl)
    setGuitarReferenceFile(null)
    setGuitarReferencePreviewUrl('')
  }

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      openLogin(() => navigate('/appointments', { replace: true }))
      return
    }
    if (!canProceed()) return
    setIsSubmittingBooking(true)
    
    try {
      let serviceReferenceImageUrl = ''
      let guitarReferenceImageUrl = ''
      if (serviceReferenceFile) {
        serviceReferenceImageUrl = await uploadToCloudinary(serviceReferenceFile, {
          folder: 'cosmoscraft/appointments/service-reference',
        })
      }
      if (guitarReferenceFile) {
        guitarReferenceImageUrl = await uploadToCloudinary(guitarReferenceFile, {
          folder: 'cosmoscraft/appointments/guitar-reference',
        })
      }

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
          appointment_type: selectedAppointmentType,
          services: selectedServices,
          location_id: selectedBranchId,
          address_id: selectedAppointmentType === 'service_home' ? homeServiceAddressId : undefined,
          guitar_details: hasSelectedGuitar
            ? {
                brand: selectedPrimaryGuitar?.brand || '',
                model: selectedPrimaryGuitar?.model || '',
                type: selectedPrimaryGuitar?.type || 'electric',
                serial: selectedPrimaryGuitar?.serial || 'N/A',
                notes: selectedPrimaryGuitar?.notes || '',
                guitars: selectedGuitarEntries,
              }
            : undefined,
          scheduled_at: scheduledAt.toISOString(),
          notes: [
            hasSelectedGuitar
              ? selectedGuitarEntries
                .map((guitar, index) => `Guitar ${index + 1}: ${guitar.brand} ${guitar.model} (${formatAppointmentGuitarTypeLabel(guitar.type)})`)
                .join('\n')
              : '',
            selectedAppointmentType === 'service_home' ? `Home service contact: ${homeServiceContact}` : '',
            serviceReferenceImageUrl ? `Service reference image: ${serviceReferenceImageUrl}` : '',
            guitarReferenceImageUrl ? `Guitar reference image: ${guitarReferenceImageUrl}` : '',
          ].filter(Boolean).join('\n')
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create appointment');
      }

      setShowBookingSuccess(true)
      setTimeout(() => {
        setShowBookingSuccess(false)
        setIsSubmittingBooking(false)
        navigate('/dashboard')
      }, 2000)

    } catch (error) {
      console.error('Submission Error:', error);
      setShowBookingSuccess(false)
      setIsSubmittingBooking(false)
      alert(`Failed to book appointment: ${error.message}`);
    }
  }

  if (isLoadingUser) {
    return (
      <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-2xl border border-[var(--border)] bg-theme-surface-deep p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">Checking your session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-2xl border border-[var(--border)] bg-theme-surface-deep p-8 text-center space-y-5">
            <h1 className="text-2xl font-bold text-white">Sign in to book an appointment</h1>
            <p className="text-sm text-[var(--text-muted)]">Booking is available only for authenticated users.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => openLogin(() => navigate('/appointments', { replace: true }))}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-colors"
              >
                Login to Continue
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-[var(--text-light)] bg-[var(--surface-dark)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors"
              >
                Go to Login Page
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- RENDERS ---

  const renderStepContent = () => {
    switch (currentStep) {
      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Select Services</h2>
              <p className="text-sm text-[var(--text-muted)]">Choose one or more professional guitar services. Our calendar availability will automatically adjust based on the expected turnaround times.</p>
            </div>
            
            <div className="space-y-6">
              {renderServiceSelection()}
              {false && availableServices.map((service) => (
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

      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Select Guitar and Service Type</h2>
              <p className="text-sm text-[var(--text-muted)]">Choose the guitar first, then select Home Service or In-store service.</p>
            </div>
            
            <div className="bg-theme-surface-deep border border-[var(--border)] p-6 rounded-2xl space-y-5">
              {savedBuilds.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white mb-1.5">Guitar Source</label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGuitarSelectionMode('saved')}
                      className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${guitarSelectionMode === 'saved' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                    >
                      Saved Guitar Build
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuitarSelectionMode('manual')}
                      className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${guitarSelectionMode === 'manual' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                    >
                      Manual Guitar Details
                    </button>
                  </div>
                </div>
              )}

              {guitarSelectionMode === 'saved' && savedBuilds.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-white mb-1.5">Select Saved Guitar</label>
                  <select
                    value={selectedSavedBuildId}
                    onChange={(e) => setSelectedSavedBuildId(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="">No saved guitar selected</option>
                    {savedBuilds.map((build) => (
                      <option key={String(build.id)} value={String(build.id)}>
                        {build.name || 'Custom Build'} - {build.isBass ? 'Bass Build' : 'Guitar Build'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-1.5">Brand</label>
                      <input
                        type="text"
                        value={guitarDetails.brand}
                        onChange={e => setGuitarDetails({ ...guitarDetails, brand: e.target.value })}
                        className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                        placeholder="e.g. Fender"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-1.5">Model</label>
                      <input
                        type="text"
                        value={guitarDetails.model}
                        onChange={e => setGuitarDetails({ ...guitarDetails, model: e.target.value })}
                        className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                        placeholder="e.g. Stratocaster"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Type</label>
                    <select
                      value={guitarDetails.type}
                      onChange={e => setGuitarDetails({ ...guitarDetails, type: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                    >
                      {APPOINTMENT_GUITAR_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {formatAppointmentGuitarTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Serial Number / Details</label>
                    <input
                      type="text"
                      value={guitarDetails.serial}
                      onChange={e => setGuitarDetails({ ...guitarDetails, serial: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                      placeholder="e.g. SN123456 or Serial: 123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Notes / Issue Description</label>
                    <textarea
                      value={guitarDetails.notes}
                      onChange={e => setGuitarDetails({ ...guitarDetails, notes: e.target.value })}
                      className="w-full h-28 px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:border-[#d4af37]"
                        placeholder="Describe the issue or service request"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[var(--text-muted)]">Optional: add one or more guitars for the service team.</p>
                      <button
                        type="button"
                        onClick={handleAddManualGuitar}
                        disabled={!hasManualGuitarDetails}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                          hasManualGuitarDetails
                            ? 'bg-[#d4af37] text-black hover:bg-[#e9c458]'
                            : 'bg-[var(--surface-dark)] text-[var(--text-muted)] border border-[var(--border)] cursor-not-allowed'
                        }`}
                      >
                        Add Guitar
                      </button>
                    </div>

                    {manualGuitars.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                        {manualGuitars.map((guitar, index) => (
                          <div key={`${guitar.brand}-${guitar.model}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-[var(--text-light)]">{guitar.brand} {guitar.model}</p>
                              <p className="text-xs text-[var(--text-muted)]">{formatAppointmentGuitarTypeLabel(guitar.type)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveManualGuitar(index)}
                              className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-red-400/60 hover:text-red-300 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Home Service <span className="text-red-400">*</span></label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHomeServiceOption('yes')}
                    className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${homeServiceOption === 'yes' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                  >
                    Yes, Home Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeServiceOption('no')}
                    className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${homeServiceOption === 'no' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                  >
                    No, In-store Service
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-light)]">Guitar Reference Image (Optional)</p>
                <p className="text-xs text-[var(--text-muted)]">Upload a guitar image reference for styling, finish, or details you want copied.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-light)] hover:border-[#d4af37]/50 hover:text-[#d4af37] transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleReferenceImageChange('guitar', event)}
                  />
                </label>
                {guitarReferencePreviewUrl && (
                  <div className="rounded-xl border border-[var(--border)] bg-theme-surface-deep p-3">
                    <img src={guitarReferencePreviewUrl} alt="Guitar reference" className="h-40 w-full rounded-lg object-cover" />
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>{guitarReferenceFile?.name || 'reference-image'}</span>
                      <button
                        type="button"
                        onClick={() => clearReferenceImage('guitar')}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 hover:border-red-400/60 hover:text-red-300 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )

      case 4:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            {selectedAppointmentType === 'service_home' ? (
              <>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Home Service Details</h2>
                  <p className="text-sm text-[var(--text-muted)]">Select your address and contact number for home service booking.</p>
                </div>

                {userAddresses.length === 0 ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <p className="text-sm text-amber-200">
                      Home service requires a saved address. Please add an address in your Dashboard profile first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-1.5">Service Address <span className="text-red-400">*</span></label>
                      <select
                        value={homeServiceAddressId}
                        onChange={(e) => setHomeServiceAddressId(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                      >
                        <option value="">Select service address</option>
                        {userAddresses.map((address) => (
                          <option key={address.address_id} value={address.address_id}>
                            {address.label || 'Address'} - {[address.street_line1, address.city, address.province].filter(Boolean).join(', ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-1.5">Contact Number <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={homeServiceContact}
                        onChange={(e) => setHomeServiceContact(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                        placeholder="e.g. 09123456789"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </motion.div>
        )

      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div>
               <h2 className="text-2xl font-bold text-white mb-2">Select Date and Time</h2>
               <p className="text-sm text-[var(--text-muted)]">Select an available date (Mon-Sat) and time. Sundays and official holidays are unavailable.</p>
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
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-xs sm:text-sm text-[var(--text-muted)] mb-3 font-medium">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <span key={d} className="text-center pb-2">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-8">
                {monthMatrix.map((week, wIdx) =>
                  week.map((day, dIdx) => {
                    if (!day.inCurrentMonth) return <div key={`empty-${wIdx}-${dIdx}`} className="h-9 sm:h-10" />

                    const isSelected = selectedDateId === day.id
                    const isUnavailable = !day.isAvailable
                    const isSunday = day.dayNumber && new Date(day.id).getDay() === 0

                    if (isUnavailable) {
                      const disabledStyle = day.isHolidayDate
                        ? 'text-[#FF3737]/80 bg-[#FF3737]/10 border border-[#FF3737]/20'
                        : day.isPastDate
                          ? 'text-[var(--text-muted)]/70 bg-[var(--surface-elevated)]/80 border border-[var(--border)]'
                          : 'text-[var(--text-muted)]/60 bg-[var(--surface-elevated)]/80 border border-[var(--border)]'

                      return (
                        <div 
                          key={day.id}
                          className={`flex items-center justify-center h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-medium transition-colors ${disabledStyle} cursor-not-allowed`}>
                          {day.dayNumber}
                        </div>
                      )
                    }

                    return (
                      <button
                        key={day.id}
                        onClick={() => {
                          setSelectedDateId(day.id)
                          setSelectedTime('')
                        }}
                        className={`flex items-center justify-center h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-[#08CB00] text-black shadow-lg shadow-[#08CB00]/20 scale-105 border border-[#08CB00]/40'
                            : 'bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] hover:bg-[#08CB00]/10 hover:border-[#08CB00]/40'
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
                  {slotsLoading && (
                    <p className="mb-3 text-xs text-[var(--text-muted)]">Checking live availability...</p>
                  )}
                  {!slotsLoading && slotAvailabilityStatus === 'fully_booked' && (
                    <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                      Fully Booked: This date already has the maximum of 5 appointments.
                    </p>
                  )}
                  {!slotsLoading && slotAvailabilityStatus === 'unavailable' && (
                    <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                      This date is unavailable for booking.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {timeSlots.map(time => {
                      const isSelected = selectedTime === time
                      const isUnavailableTime = !availableTimeSet.has(time.toUpperCase())
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          disabled={isUnavailableTime || slotsLoading}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#d4af37] text-black'
                              : isUnavailableTime
                                ? 'bg-[var(--surface-elevated)] text-[var(--text-muted)]/70 border border-[var(--border)] cursor-not-allowed line-through'
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
                    <p className="text-sm font-medium text-[var(--text-light)]">
                      {selectedAppointmentType === 'service_home'
                        ? 'Home Service'
                        : currentBranch.name}
                    </p>
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
                      {selectedGuitarEntries.length > 0 ? (
                        selectedGuitarEntries.map((guitar, index) => (
                          <div key={`${guitar.brand}-${guitar.model}-${index}`} className={index > 0 ? 'pt-2 mt-2 border-t border-[var(--border)]' : ''}>
                            <p><span className="text-[var(--text-muted)]">Guitar {index + 1}:</span> <span className="text-[var(--text-light)]">{guitar.brand} {guitar.model}</span></p>
                            <p><span className="text-[var(--text-muted)]">Type:</span> <span className="text-[var(--text-light)]">{formatAppointmentGuitarTypeLabel(guitar.type)}</span></p>
                            {guitar.notes && (
                              <p><span className="text-[var(--text-muted)]">Notes:</span> <span className="text-[var(--text-light)]">{guitar.notes}</span></p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[var(--text-muted)]">No guitar selected</p>
                      )}
                      {selectedAppointmentType === 'service_home' && (
                        <>
                          <p><span className="text-[var(--text-muted)]">Address:</span> <span className="text-[var(--text-light)]">{userAddresses.find(a => a.address_id === homeServiceAddressId)?.street_line1 || 'Not selected'}</span></p>
                          <p><span className="text-[var(--text-muted)]">Contact:</span> <span className="text-[var(--text-light)]">{homeServiceContact || 'Not provided'}</span></p>
                        </>
                      )}
                    </div>
                 </div>
               </div>

               {(serviceReferencePreviewUrl || guitarReferencePreviewUrl) && (
                 <div className="border-t border-[var(--border)] pt-4">
                   <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Reference Images</p>
                   <div className="grid sm:grid-cols-2 gap-4">
                     {serviceReferencePreviewUrl && (
                       <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                         <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Service Reference</p>
                         <img src={serviceReferencePreviewUrl} alt="Service reference preview" className="h-36 w-full rounded-lg object-cover" />
                       </div>
                     )}
                     {guitarReferencePreviewUrl && (
                       <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                         <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Guitar Reference</p>
                         <img src={guitarReferencePreviewUrl} alt="Guitar reference preview" className="h-36 w-full rounded-lg object-cover" />
                       </div>
                     )}
                   </div>
                 </div>
               )}

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        
        {/* Header Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-light)] transition-colors mb-8 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium text-sm">Back to Dashboard</span>
        </button>

        <div className="grid xl:grid-cols-[280px_1fr] gap-6 lg:gap-8 xl:gap-12 min-h-[600px]">
          
          {/* LEFT SIDEBAR (STEPPER) */}
          <div className="bg-theme-surface-deep border border-[var(--border)] rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col justify-between">
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
               Need help with booking?
               <br />
               <a
                 href="https://www.facebook.com/messages/t/CosmosGuitars"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="font-semibold text-[#d4af37] hover:text-[#ffe270] transition-colors"
               >
                 Contact our support
               </a>
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
            <div className="mt-8 pt-6 border-t border-[var(--border)]">
              {currentStep < 5 && !canProceed() && (
                <p className="mb-4 text-sm font-medium text-red-400">{getStepValidationMessage()}</p>
              )}
              <div className="flex items-center justify-between">
               <button
                 onClick={handlePrevStep}
                 disabled={currentStep === 1 || isSubmittingBooking}
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
                   Next
                 </button>
               ) : (
                 <button
                   onClick={handleSubmit}
                   disabled={isSubmittingBooking}
                   className="px-8 py-2.5 rounded-xl text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] shadow-[#d4af37]/20 flex items-center gap-2"
                 >
                   {isSubmittingBooking ? (
                     <>Processing... <Settings className="w-4 h-4 animate-spin" /></>
                   ) : (
                     "Complete Booking"
                   )}
                 </button>
               )}
              </div>
            </div>
          </div>

        </div>

        {/* Global Success Overlay */}
        <AnimatePresence>
          {showBookingSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-[100] bg-[var(--overlay-dark)]"
            >
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--surface-dark)] border border-[#d4af37]/50 rounded-3xl p-10 text-center max-w-sm mx-4 shadow-2xl">
                <div className="w-20 h-20 bg-[#d4af37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-[#d4af37]" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-light)] mb-2">Booking Confirmed!</h3>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Your appointment has been scheduled successfully. You will be redirected to the dashboard.
                </p>
                {referenceNumber && (
                   <p className="text-xs font-mono text-[#f4d76b] bg-[#d4af37]/15 py-2 rounded-lg border border-[#d4af37]/30">
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

