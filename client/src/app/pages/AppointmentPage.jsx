  import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
  import { useNavigate, useLocation } from 'react-router'
  import { motion, AnimatePresence } from 'motion/react'
  import { API, getAuthHeaders } from '../utils/apiConfig'
  import { uploadToCloudinary } from '../utils/cloudinary.js'
  import { useAuth } from '../context/AuthContext.jsx'
  import { useSocketEvent } from '../context/SocketContext.jsx'
  import { useToast } from '../components/ui/Toast.jsx'
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
    FileText,
    Loader2,
    Pencil,
    Plus,
  } from 'lucide-react'
  import { AddressForm } from '../components/AddressForm.jsx'
  import { adminApi } from '../utils/adminApi'
  import {
    PHONE_ERROR_MESSAGE,
    isValidPhoneNumber,
    normalizePhoneForSubmit,
    sanitizePhoneInput,
  } from '../utils/phone.js'

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
    { id: 2, label: 'Appointment' },
    { id: 3, label: 'Guitar & Service Type' },
    { id: 4, label: 'Location' },
    { id: 5, label: 'Confirmation' },
  ]

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

    const durationMinutes = Number(service.duration_minutes || 0)
    if (durationMinutes > 0) {
      const durationDays = durationMinutes / (60 * 24)
      if (durationDays >= 1) return Math.ceil(durationDays)
      return 0
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
    const durationMinutes = Number(service.duration_minutes || 0)
    if (durationMinutes > 0) {
      const hours = durationMinutes / 60
      const formattedHours = Number.isInteger(hours) ? hours : Number(hours.toFixed(1))

      if (hours < 24) {
        if (hours <= 1) return 'Up to 1 hour turnaround'
        return `Up to ${formattedHours} hour${formattedHours > 1 ? 's' : ''} turnaround`
      }

      const days = Math.ceil(hours / 24)
      return `Up to ${days} day${days > 1 ? 's' : ''} turnaround`
    }

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

  function parseTimeLabelTo24(timeLabel = '') {
    const match = String(timeLabel).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return null

    let hour = Number(match[1])
    const minute = Number(match[2])
    const period = match[3].toUpperCase()

    if (hour === 12) {
      hour = period === 'AM' ? 0 : 12
    } else if (period === 'PM') {
      hour += 12
    }

    return { hour, minute }
  }

  const APPT_DRAFT_KEY = 'cosmoscraft.appointment.draft'

  function saveAppointmentDraft(draft) {
    try {
      if (typeof window === 'undefined') return
      window.sessionStorage.setItem(APPT_DRAFT_KEY, JSON.stringify(draft))
    } catch {}
  }

  function loadAppointmentDraft() {
    try {
      if (typeof window === 'undefined') return null
      const raw = window.sessionStorage.getItem(APPT_DRAFT_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function clearAppointmentDraft() {
    try {
      if (typeof window === 'undefined') return
      window.sessionStorage.removeItem(APPT_DRAFT_KEY)
    } catch {}
  }

  function isPastTimeSlot(dateId, timeLabel) {
    const parsed = parseTimeLabelTo24(timeLabel)
    if (!parsed || !dateId) return false

    const slotDate = new Date(`${dateId}T${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:00`)
    return slotDate < new Date()
  }

  function normalizeAppointmentGuitarType(value = '') {
    return String(value || '').trim().toLowerCase()
  }

  function formatAppointmentGuitarTypeLabel(value = '') {
    const normalized = normalizeAppointmentGuitarType(value)
    if (!normalized) return '—'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  function formatSummaryLabel(key = '') {
    return String(key)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function getMonthMatrix(year, month, maxLeadTimeDays, disabledDateSet = new Set(), openOverrideSet = new Set()) {
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
        let isOpenHoliday = false
        let isUnavailableDate = false

        if (inCurrentMonth) {
          id = formatLocalDateId(date)
          const isPast = date < today
          const isTooSoon = date < minAvailableDate
          const isSunday = date.getDay() === 0
          const isHolidayDay = isHoliday(date)
          isOpenHoliday = isHolidayDay && openOverrideSet.has(id)
          isHolidayDate = isHolidayDay && !isOpenHoliday
          isUnavailableDate = disabledDateSet.has(id)
          isAvailable = !isPast && !isTooSoon && !isSunday && !isHolidayDate && !isUnavailableDate
        }

        week.push({
          id,
          dayNumber: inCurrentMonth ? date.getDate() : null,
          inCurrentMonth,
          isAvailable,
          isHolidayDate,
          isOpenHoliday,
          // Blocked by the shop (admin marked the date unavailable), as opposed
          // to a Sunday/holiday or a past date. The calendar marks these red.
          isUnavailableDate,
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
    const location = useLocation()
    const { user, isAuthenticated, isLoadingUser, openLogin, updateUser } = useAuth()
    const today = new Date()
    const branch = useMemo(() => getAppointmentBranch(), [])
    const branches = useMemo(() => [branch], [branch])
    const userAddresses = Array.isArray(user?.addresses) ? user.addresses : []
    const savedBuilds = useMemo(() => {
    // Only return saved builds when the user is authenticated.
    // localStorage is shared across sessions on the same browser, so we must
    // gate reads on auth state to avoid leaking another account's builds.
    if (!isAuthenticated) return []
    if (typeof window === 'undefined') return []

    const savedGuitarBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]').map((build) => ({ ...build, isBass: false }))
    const savedBassBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').map((build) => ({ ...build, isBass: true }))
    return [...savedGuitarBuilds, ...savedBassBuilds]
  }, [isAuthenticated])

    // Reschedule mode - check if we're editing an existing appointment
    const rescheduleData = location.state?.rescheduleAppointment || null
    const isRescheduleMode = Boolean(rescheduleData)

    // State
    const [currentStep, setCurrentStep] = useState(1)
    
    // Selections
    const [guitarSelectionMode, setGuitarSelectionMode] = useState(savedBuilds.length > 0 ? 'saved' : 'manual')
    const [selectedSavedBuildId, setSelectedSavedBuildId] = useState('')
    // Customization ids the customer actually bought (ordered / in a live project).
    // Saved builds that were never purchased are build-only drafts and must not be selectable.
    const [purchasedCustomizationIds, setPurchasedCustomizationIds] = useState(null)
    const [homeServiceOption, setHomeServiceOption] = useState('')
    const [homeServiceAddressId, setHomeServiceAddressId] = useState('')
    const [homeServiceContact, setHomeServiceContact] = useState(user?.phone || '')
    const [showPhoneForm, setShowPhoneForm] = useState(false)
    const [newPhone, setNewPhone] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [phoneSaving, setPhoneSaving] = useState(false)
    const [contactError, setContactError] = useState('')
    // Address add/edit panel (empty = closed, 'add' = new address, 'edit' = editing the selected one)
    const [addressPanelMode, setAddressPanelMode] = useState('')
    const [addressFormSaving, setAddressFormSaving] = useState(false)
    const [availableServices, setAvailableServices] = useState([])
    const [servicesError, setServicesError] = useState('')
    const [servicesLoading, setServicesLoading] = useState(true)
    const [serviceSearch, setServiceSearch] = useState('')
    const [selectedServiceIds, setSelectedServiceIds] = useState([])
    const [guitarDetails, setGuitarDetails] = useState({ brand: '', model: '', type: 'electric', notes: '' })
    const [serviceReferenceFile, setServiceReferenceFile] = useState(null)
    const [serviceReferencePreviewUrl, setServiceReferencePreviewUrl] = useState('')
    const [guitarReferenceFile, setGuitarReferenceFile] = useState(null)
    const [guitarReferencePreviewUrl, setGuitarReferencePreviewUrl] = useState('')
    const [selectedBranchId] = useState(branches[0].id)
    const [selectedDateId, setSelectedDateId] = useState('')
    const [selectedTime, setSelectedTime] = useState('')
    const [unavailableDateSet, setUnavailableDateSet] = useState(new Set())
    const [openOverrideSet, setOpenOverrideSet] = useState(new Set())
    const [availableTimeSet, setAvailableTimeSet] = useState(new Set())
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [dailyAppointmentLoad, setDailyAppointmentLoad] = useState(null)
    const [slotAvailabilityStatus, setSlotAvailabilityStatus] = useState('')
    // Payment method selection
    const { toast } = useToast()

    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
    const [paymentSettings, setPaymentSettings] = useState(null)
    const [showGcashQr, setShowGcashQr] = useState(true)
    const PAYMENT_METHODS = [
      { value: 'cash', label: 'Cash', description: 'Pay with cash on the appointment date' },
      { value: 'e_wallet', label: 'E-Wallet', description: 'Pay via GCash, Maya, or other e-wallet services' },
      { value: 'e_bank', label: 'E-Bank', description: 'Pay via online bank transfer' },
    ]
    const FALLBACK_QR = '/gcashqrcode.png'
    const FALLBACK_BANK = {
      bankName: 'BDO Unibank',
      accountName: 'CosmosCraft Guitar Shop',
      accountNumber: '1234 5678 9012',
    }
    const [paymentProofFile, setPaymentProofFile] = useState(null)
    const [paymentProofPreviewUrl, setPaymentProofPreviewUrl] = useState('')
    const [paymentValidationError, setPaymentValidationError] = useState('')
    
    // Dedicated notes field for additional information (landmarks, delivery instructions, special requests, etc.)
    const [additionalNotes, setAdditionalNotes] = useState('')
    
    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(today.getMonth())
    const [currentYear, setCurrentYear] = useState(today.getFullYear())
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
    const [showBookingSuccess, setShowBookingSuccess] = useState(false)
    const [appointmentDraftHydrated, setAppointmentDraftHydrated] = useState(false)
    const pendingSubmitRef = useRef(false)
    const pendingNextStepRef = useRef(null)

    useEffect(() => {
      const fetchPaymentSettings = async () => {
        try {
          const response = await fetch(`${API}/api/payment-settings`, {
            credentials: 'include',
          })
          const json = await response.json()
          if (json?.success && json?.data) {
            setPaymentSettings(json.data)
          }
        } catch {
          setPaymentSettings(null)
        }
      }

      fetchPaymentSettings()
    }, [])

    useEffect(() => {
      if (isLoadingUser) return
      const draft = loadAppointmentDraft()
      const hasServiceRoute = typeof window !== 'undefined' && Boolean(
        new URLSearchParams(window.location.search).get('service')
        || new URLSearchParams(window.location.search).get('serviceName')
        || new URLSearchParams(window.location.search).get('selectedService')
      )
      if (draft) {
        if (draft.currentStep && !hasServiceRoute) setCurrentStep(draft.currentStep)
        if (draft.guitarSelectionMode) setGuitarSelectionMode(draft.guitarSelectionMode)
        if (draft.selectedSavedBuildId) setSelectedSavedBuildId(draft.selectedSavedBuildId)
        if (draft.homeServiceOption) setHomeServiceOption(draft.homeServiceOption)
        if (draft.homeServiceAddressId) setHomeServiceAddressId(draft.homeServiceAddressId)
        if (draft.homeServiceContact) setHomeServiceContact(draft.homeServiceContact)
        if (draft.selectedServiceIds) {
          setSelectedServiceIds(Array.isArray(draft.selectedServiceIds) ? draft.selectedServiceIds : [draft.selectedServiceIds])
        } else if (draft.selectedServiceId) {
          setSelectedServiceIds([draft.selectedServiceId])
        }
        if (draft.guitarDetails) setGuitarDetails(draft.guitarDetails)
        if (draft.selectedDateId) setSelectedDateId(draft.selectedDateId)
        if (draft.selectedTime) setSelectedTime(draft.selectedTime)
        if (draft.selectedPaymentMethod) setSelectedPaymentMethod(draft.selectedPaymentMethod)
        if (draft.additionalNotes) setAdditionalNotes(draft.additionalNotes)
        clearAppointmentDraft()
      }
      setAppointmentDraftHydrated(true)
    }, [isAuthenticated, isLoadingUser])

    useEffect(() => {
      if (!isAuthenticated) return
      if (pendingNextStepRef.current === null) return
      const targetStep = pendingNextStepRef.current
      pendingNextStepRef.current = null
      setCurrentStep(targetStep)
    }, [isAuthenticated])

    useEffect(() => {
      if (!isAuthenticated) return
      if (!pendingSubmitRef.current) return
      pendingSubmitRef.current = false
      const t = window.setTimeout(() => {
        handleSubmit()
      }, 0)
      return () => window.clearTimeout(t)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])

    useEffect(() => {
      if (!appointmentDraftHydrated || isAuthenticated) return
      if (showBookingSuccess) {
        clearAppointmentDraft()
        return
      }

      saveAppointmentDraft({
        currentStep,
        guitarSelectionMode,
        selectedSavedBuildId,
        homeServiceOption,
        homeServiceAddressId,
        homeServiceContact,
        selectedServiceIds,
        guitarDetails,
        selectedDateId,
        selectedTime,
        selectedPaymentMethod,
        additionalNotes,
      })
    }, [
      appointmentDraftHydrated,
      isAuthenticated,
      showBookingSuccess,
      currentStep,
      guitarSelectionMode,
      selectedSavedBuildId,
      homeServiceOption,
      homeServiceAddressId,
      homeServiceContact,
      selectedServiceIds,
      guitarDetails,
      selectedDateId,
      selectedTime,
      selectedPaymentMethod,
      additionalNotes,
    ])

    useEffect(() => {
      if (isAuthenticated && savedBuilds.length > 0) {
        setGuitarSelectionMode((prev) => (prev === 'manual' && !selectedSavedBuildId ? 'saved' : prev))
      }
    }, [isAuthenticated, savedBuilds.length, selectedSavedBuildId])

    useEffect(() => {
      if (!isAuthenticated) {
        setHomeServiceOption('no')
      }
    }, [isAuthenticated])

    const timeSlots = useMemo(
      () => ['9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'],
      []
    )

    const currentBranch = branches.find(b => b.id === selectedBranchId)
    const selectedDate = selectedDateId ? new Date(`${selectedDateId}T00:00:00`) : null
    const allTimeSlotsDisabled = selectedDateId && timeSlots.every((time) => {
      const isUnavailableTime = !availableTimeSet.has(time.toUpperCase())
      const isPastTime = isPastTimeSlot(selectedDateId, time)
      return isUnavailableTime || isPastTime
    })
    const hasAvailableTimeSlots = selectedDateId && timeSlots.some((time) => {
      const isUnavailableTime = !availableTimeSet.has(time.toUpperCase())
      const isPastTime = isPastTimeSlot(selectedDateId, time)
      return !isUnavailableTime && !isPastTime
    })

    const selectedAppointmentType = homeServiceOption === 'yes' ? 'service_home' : homeServiceOption === 'no' ? 'service_in_shop' : ''

    useEffect(() => {
      if (!availableServices.length || typeof window === 'undefined') return

      const params = new URLSearchParams(location.search)
      const requestedStep = Number(params.get('step') || '0')
      const requestedService = params.get('service') || params.get('serviceName') || params.get('selectedService')

      if (requestedStep >= 1 && requestedStep <= 5) {
        setCurrentStep(requestedStep)
      }

      if (!requestedService) return

      const normalizeServiceText = (value = '') =>
        String(value)
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
          .replace(/\s+/g, ' ')

      const normalizedRequest = normalizeServiceText(requestedService)
      const match = availableServices.find((service) => {
        const name = String(service.name || '')
        const normalizedServiceName = normalizeServiceText(name)
        const aliases = [
          normalizedServiceName,
          normalizeServiceText(service.slug || ''),
          normalizeServiceText(name.replace(/\s*&\s*/g, ' and ')),
        ]
        return aliases.includes(normalizedRequest)
          || normalizedServiceName.includes(normalizedRequest)
          || normalizedRequest.includes(normalizedServiceName)
      })

      if (match) {
        setSelectedServiceIds((prev) => prev.includes(String(match.service_id)) ? prev : [...prev, String(match.service_id)])
        setCurrentStep(1)
        const nextParams = new URLSearchParams(params)
        nextParams.delete('service')
        nextParams.delete('serviceName')
        nextParams.delete('selectedService')
        nextParams.delete('step')
        const nextUrl = `${window.location.pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`
        window.history.replaceState({}, '', nextUrl)
      }
    }, [availableServices, location.search])

    const hasManualGuitarDetails = Boolean(
      guitarDetails.brand.trim()
      && guitarDetails.model.trim()
      && normalizeAppointmentGuitarType(guitarDetails.type)
    )

    // Only guitars the customer actually bought from the system may be picked from
    // the saved list. A build that was configured but never ordered stays hidden.
    const purchasableBuilds = useMemo(() => {
      if (purchasedCustomizationIds === null) return []
      return savedBuilds.filter((build) => {
        const customizationId = build.dbCustomizationId || build.customization_id
        if (!customizationId) return false
        return purchasedCustomizationIds.has(String(customizationId))
      })
    }, [savedBuilds, purchasedCustomizationIds])

    useEffect(() => {
      if (!isAuthenticated) {
        setPurchasedCustomizationIds(new Set())
        return
      }

      let cancelled = false

      adminApi.getMyCustomizations()
        .then((response) => {
          if (cancelled) return
          const customizations = Array.isArray(response?.data) ? response.data : []
          const purchased = new Set()
          for (const customization of customizations) {
            const isPurchased = Boolean(
              customization?.is_locked
              || customization?.active_order_id
              || customization?.active_project_id
            )
            if (isPurchased && customization?.customization_id) {
              purchased.add(String(customization.customization_id))
            }
          }
          setPurchasedCustomizationIds(purchased)
        })
        .catch((error) => {
          console.error('Failed to load purchased guitars:', error)
          if (!cancelled) setPurchasedCustomizationIds(new Set())
        })

      return () => { cancelled = true }
    }, [isAuthenticated])

    // Saved-build option disappears once we know nothing was bought, so fall back
    // to manual entry and drop any selection that is no longer offered.
    useEffect(() => {
      if (purchasableBuilds.length > 0) return
      setGuitarSelectionMode((mode) => (mode === 'saved' ? 'manual' : mode))
      setSelectedSavedBuildId((currentId) => {
        if (!currentId) return currentId
        const stillOffered = purchasableBuilds.some((build) => String(build.id) === String(currentId))
        return stillOffered ? currentId : ''
      })
    }, [purchasableBuilds])

    const selectedSavedBuilds = useMemo(
      () => purchasableBuilds.filter((build) => String(build.id) === String(selectedSavedBuildId)),
      [selectedSavedBuildId, purchasableBuilds]
    )
    const selectedServices = useMemo(
      () => availableServices.filter((item) => selectedServiceIds.includes(String(item.service_id))),
      [availableServices, selectedServiceIds]
    )
    const selectedService = useMemo(
      () => selectedServices[0] || null,
      [selectedServices]
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
          details: Object.entries(build.summary || {})
            .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
            .map(([key, value]) => ({ label: formatSummaryLabel(key), value: String(value) })),
        }))
      }

      if (!hasManualGuitarDetails) return []
      return [{
        brand: guitarDetails.brand.trim(),
        model: guitarDetails.model.trim(),
        type: normalizeAppointmentGuitarType(guitarDetails.type),
        serial: 'N/A',
        notes: guitarDetails.notes.trim(),
      }]
    }, [guitarDetails, guitarSelectionMode, hasManualGuitarDetails, selectedSavedBuilds])
    const hasSelectedGuitar = selectedGuitarEntries.length > 0
    const filteredServices = useMemo(() => {
      const searchTerm = String(serviceSearch || '').trim().toLowerCase()
      return availableServices.filter((service) => {
        if (!searchTerm) return true
        return [service.name, service.description].some((field) =>
          String(field || '').toLowerCase().includes(searchTerm)
        )
      })
    }, [availableServices, serviceSearch])

    // Pre-fill form when in reschedule mode
    useEffect(() => {
      if (!isRescheduleMode || !rescheduleData) return

      // Pre-fill service
      if (Array.isArray(rescheduleData.services) && rescheduleData.services.length > 0) {
        setSelectedServiceIds(rescheduleData.services.map(String))
      }

      // Pre-fill home service option
      if (rescheduleData.appointment_type === 'service_home') {
        setHomeServiceOption('yes')
      } else if (rescheduleData.appointment_type === 'service_in_shop') {
        setHomeServiceOption('no')
      }

      // Pre-fill guitar details
      if (rescheduleData.guitar_details) {
        const gd = rescheduleData.guitar_details
        setGuitarDetails({
          brand: gd.brand || '',
          model: gd.model || '',
          type: gd.type || 'electric',
          notes: gd.notes || '',
        })
        // If there are saved builds, try to match
        if (gd.brand && gd.model && savedBuilds.length > 0) {
          setGuitarSelectionMode('manual')
        }
      }

      // Pre-fill notes
      if (rescheduleData.notes) {
        // Extract non-image text from notes
        const textLines = rescheduleData.notes.split('\n').filter(line => {
          const imageMatch = line.match(/(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i)
          return !imageMatch
        })
        setAdditionalNotes(textLines.filter(Boolean).join('\n'))
      }
    }, [isRescheduleMode, rescheduleData, savedBuilds])

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

    /**
     * Reads the shop's closed dates and reopened holidays.
     *
     * Declared at component level (not inside the mount effect) so the socket
     * subscription below can re-run it the moment an admin changes the schedule.
     * The mounted flag lives in a ref because the socket callback outlives any
     * single effect run and must not set state after unmount.
     */
    const isMountedRef = useRef(true)

    const loadUnavailableDates = useCallback(async () => {
      try {
        const [unavailRes, overrideRes] = await Promise.all([
          fetch(`${API}/api/appointments/unavailable-dates`, {
            credentials: 'include',
          }),
          fetch(`${API}/api/appointments/open-overrides`, {
            credentials: 'include',
          }).catch(() => null),
        ])

        const payload = await unavailRes.json().catch(() => ({}))
        const overridePayload = overrideRes && overrideRes.ok ? await overrideRes.json().catch(() => ({})) : null

        if (!unavailRes.ok) {
          if (!isMountedRef.current) return
          setUnavailableDateSet(new Set())
          setOpenOverrideSet(new Set())
          return
        }

        const dates = Array.isArray(payload?.data?.unavailable_dates) ? payload.data.unavailable_dates : []
        const nextSet = new Set(
          dates
            .map((entry) => String(entry?.date || '').slice(0, 10))
            .filter(Boolean)
        )

        const overrideDates = Array.isArray(overridePayload?.data?.open_overrides) ? overridePayload.data.open_overrides : []
        const nextOverrideSet = new Set(
          overrideDates
            .map((entry) => String(entry?.date || '').slice(0, 10))
            .filter(Boolean)
        )

        if (!isMountedRef.current) return

        setUnavailableDateSet(nextSet)
        setOpenOverrideSet(nextOverrideSet)

        // The admin may have just closed the day the customer had selected.
        setSelectedDateId((current) => {
          if (current && nextSet.has(current)) {
            setSelectedTime('')
            return ''
          }
          return current
        })
      } catch {
        if (isMountedRef.current) {
          setUnavailableDateSet(new Set())
          setOpenOverrideSet(new Set())
        }
      }
    }, [])

    useEffect(() => {
      isMountedRef.current = true

      loadUnavailableDates()

      return () => {
        isMountedRef.current = false
      }
    }, [loadUnavailableDates])

    /**
     * Live schedule updates. `appointment:schedule_updated` is broadcast when an
     * admin closes a date or reopens a holiday, so a customer already sitting on
     * step 2 sees the change without reloading. The payload is a hint only; this
     * re-reads the public endpoints so the server stays the source of truth.
     */
    useSocketEvent('appointment:schedule_updated', () => {
      loadUnavailableDates()
    })

    useEffect(() => {
      let isMounted = true

      const loadAvailableSlots = async () => {
        if (!selectedDateId || unavailableDateSet.has(selectedDateId)) {
          setAvailableTimeSet(new Set())
          setDailyAppointmentLoad(null)
          setSlotAvailabilityStatus('')
          return
        }

        const fallbackServiceId = selectedServiceIds[0] || availableServices[0]?.service_id
        if (!fallbackServiceId) {
          setAvailableTimeSet(new Set(timeSlots))
          setDailyAppointmentLoad(null)
          setSlotAvailabilityStatus('open')
          return
        }

        setSlotsLoading(true)
        setDailyAppointmentLoad(null)
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
          setDailyAppointmentLoad({
            reserved: Number(payload?.data?.daily_appointments),
            capacity: Number(payload?.data?.max_daily_appointments),
          })
          setSlotAvailabilityStatus(availabilityStatus)
          if (selectedTime && (!nextSet.has(selectedTime.toUpperCase()) || isPastTimeSlot(selectedDateId, selectedTime))) {
            setSelectedTime('')
          }
        } catch {
          if (isMounted) {
            const fallbackSet = new Set(timeSlots.map((slot) => slot.toUpperCase()))
            setAvailableTimeSet(fallbackSet)
            setDailyAppointmentLoad(null)
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
    }, [availableServices, selectedDateId, selectedServiceIds, selectedTime, timeSlots, unavailableDateSet])

    // Derived calculations
    const { maxLeadTime, totalPrice, selectedDetailedServices } = useMemo(() => {
      if (selectedServices.length === 0) {
        return { maxLeadTime: 0, totalPrice: 0, selectedDetailedServices: [] }
      }

      const detailed = selectedServices.map((service) => ({
        id: String(service.service_id),
        name: service.name,
        price: Number(service.price || 0),
        desc: service.description || '',
        duration_minutes: Number(service.duration_minutes || 0),
        icon: inferServiceIcon(service),
      }))

      return {
        maxLeadTime: Math.max(...selectedServices.map((service) => inferLeadTimeDays(service))),
        totalPrice: detailed.reduce((sum, service) => sum + Number(service.price || 0), 0),
        selectedDetailedServices: detailed,
      }
    }, [selectedServices])

    const monthMatrix = useMemo(
      () => getMonthMatrix(currentYear, currentMonth, maxLeadTime, unavailableDateSet, openOverrideSet),
      [currentYear, currentMonth, maxLeadTime, unavailableDateSet, openOverrideSet]
    )

    const referenceNumber = selectedDate && selectedTime
      ? `CC-${selectedBranchId.toUpperCase()}-${selectedDateId.replace(/-/g, '')}-${selectedTime.replace(/[:\s]/g, '')}`
      : ''

    const selectedPrimaryGuitar = selectedGuitarEntries[0] || null

    // Validation
    const canProceed = () => {
      if (currentStep === 1) return selectedServiceIds.length > 0
      if (currentStep === 2) return selectedDateId && selectedTime
      if (currentStep === 3) {
        if (!hasSelectedGuitar) return false
        return Boolean(selectedAppointmentType)
      }
      if (currentStep === 4) {
        if (selectedAppointmentType === 'service_home') {
          return Boolean(homeServiceAddressId && isValidPhoneNumber(homeServiceContact))
        }
        return !!selectedBranchId
      }
      if (currentStep === 5) {
        if (!selectedPaymentMethod) return false
        if (selectedPaymentMethod === 'e_wallet' || selectedPaymentMethod === 'e_bank') {
          return Boolean(paymentProofFile && paymentProofPreviewUrl)
        }
        return true
      }
      return true
    }

    const getStepValidationMessage = () => {
      if (currentStep === 1) {
        if (selectedServiceIds.length === 0) return 'Select at least one service to continue.'
      }
      if (currentStep === 2) {
        if (!selectedDateId || !selectedTime) return 'Select both appointment date and time.'
      }
      if (currentStep === 3) {
        if (!hasSelectedGuitar) return 'Please select a guitar before continuing*.'
        if (!selectedAppointmentType) return 'Please choose Home Service: Yes or No.'
      }
      if (currentStep === 4 && selectedAppointmentType === 'service_home') {
        if (!homeServiceAddressId) return 'Select your home service address.'
        if (!homeServiceContact.trim()) return 'Enter your contact number for home service.'
        if (!isValidPhoneNumber(homeServiceContact)) return PHONE_ERROR_MESSAGE
      }
      return ''
    }

    // Handlers
    const handleToggleService = (serviceId) => {
      const normalizedServiceId = String(serviceId)
      setSelectedServiceIds((prev) => prev.includes(normalizedServiceId)
        ? prev.filter((id) => id !== normalizedServiceId)
        : [...prev, normalizedServiceId])
    }

    const renderServiceOption = (service) => {
      const serviceId = String(service.service_id)
      const isSelected = selectedServiceIds.includes(serviceId)
      const Icon = inferServiceIcon(service)

      return (
        <button
          key={serviceId}
          type="button"
          onClick={() => handleToggleService(serviceId)}
          className={`flex h-full min-h-[200px] w-full flex-col text-left rounded-xl border-2 p-4 transition-all ${
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
              <div className="min-w-0">
                <span className={`block text-sm font-semibold ${isSelected ? 'text-[#d4af37]' : 'text-[var(--text-light)]'}`}>
                  {service.name}
                </span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {formatLeadTimeLabel(service)}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-sm font-bold text-[var(--text-muted)]">PHP {Number(service.price || 0).toLocaleString('en-PH')}</span>
          </div>
          <p className="flex-1 text-xs leading-relaxed text-[var(--text-muted)]">
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

      const isDesktopScrollable = filteredServices.length > 4

      return (
        <div className="space-y-6">
          <div className="space-y-3">
            {isDesktopScrollable ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 xl:block">
                {filteredServices.map((service) => renderServiceOption(service))}
              </div>
            ) : (
              <div className="grid gap-3 max-h-[55vh] overflow-y-auto pr-1 md:max-h-[62vh] xl:grid-cols-2 xl:max-h-none xl:overflow-visible xl:pr-0">
                {filteredServices.map((service) => renderServiceOption(service))}
              </div>
            )}
          </div>
        </div>
      )
    }

    const handleNextStep = () => {
      if (!canProceed() || currentStep >= 5) return

      const nextStep = currentStep + 1
      if (nextStep === 4 && selectedAppointmentType === 'service_home' && !isAuthenticated) {
        saveAppointmentDraft({
          currentStep: nextStep,
          guitarSelectionMode,
          selectedSavedBuildId,
          homeServiceOption,
          homeServiceAddressId,
          homeServiceContact,
          selectedServiceIds,
          guitarDetails,
          selectedDateId,
          selectedTime,
          selectedPaymentMethod,
          additionalNotes,
        })
        pendingNextStepRef.current = nextStep
        openLogin()
        return
      }

      setCurrentStep(nextStep)
    }

    const handlePrevStep = () => {
      if (currentStep > 1) {
        setCurrentStep(s => s - 1)
      }
    }

    const handleSavePhone = async () => {
      const trimmed = newPhone.trim()
      if (!isValidPhoneNumber(trimmed)) {
        setPhoneError(PHONE_ERROR_MESSAGE)
        return
      }

      setPhoneError('')
      setPhoneSaving(true)

      try {
        const response = await fetch(`${API}/api/users/me/phone`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ phone: trimmed }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Failed to save phone number')
        }

        const savedPhone = data.data?.user?.phone || trimmed
        updateUser({ phone: savedPhone })
        setHomeServiceContact(savedPhone)
        setShowPhoneForm(false)
        setNewPhone('')
        toast.success('Phone number saved successfully')
      } catch (error) {
        toast.error(error.message || 'Failed to save phone number')
      } finally {
        setPhoneSaving(false)
      }
    }

    const closeAddressPanel = () => {
      setAddressPanelMode('')
    }

    // Persists a new/edited address from the Step 4 panel, refreshes the cached
    // profile addresses and keeps it selected so booking can continue immediately.
    const handleSaveAppointmentAddress = async (payload) => {
      setAddressFormSaving(true)
      try {
        const response = addressPanelMode === 'edit' && homeServiceAddressId
          ? await adminApi.updateAddress(homeServiceAddressId, payload)
          : await adminApi.addAddress({ ...payload, isDefault: Boolean(payload?.isDefault) })

        let addresses = response?.data?.user?.addresses
        if (!Array.isArray(addresses) || addresses.length === 0) {
          const profile = await adminApi.getProfile()
          addresses = profile?.data?.user?.addresses
        }
        if (Array.isArray(addresses) && addresses.length > 0) {
          updateUser({ addresses })
        }

        const savedAddress = Array.isArray(addresses)
          ? addresses.find((address) => (
              addressPanelMode === 'edit' && homeServiceAddressId
                ? String(address.address_id) === String(homeServiceAddressId)
                : String(address.street_line1 || '') === String(payload.streetLine1 || '')
            ))
          : null

        if (savedAddress?.address_id) {
          setHomeServiceAddressId(String(savedAddress.address_id))
        }

        closeAddressPanel()
        toast.success(addressPanelMode === 'edit' ? 'Address updated successfully' : 'Address added successfully')
      } catch (error) {
        toast.error(error.message || 'Failed to save address')
      } finally {
        setAddressFormSaving(false)
      }
    }

    const handleReferenceImageChange = (target, event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file.')
        return
      }
      if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
        toast.error('Image size must be 10MB or less.')
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

    const handlePaymentProofChange = (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file for payment proof.')
        return
      }
      if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
        toast.error('Image size must be 10MB or less.')
        return
      }

      if (paymentProofPreviewUrl) URL.revokeObjectURL(paymentProofPreviewUrl)
      const objectUrl = URL.createObjectURL(file)
      setPaymentProofFile(file)
      setPaymentProofPreviewUrl(objectUrl)
    }

    const clearPaymentProof = () => {
      if (paymentProofPreviewUrl) URL.revokeObjectURL(paymentProofPreviewUrl)
      setPaymentProofFile(null)
      setPaymentProofPreviewUrl('')
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

    // Compute the final notes to send to the API
    const computedNotes = useMemo(() => {
      return additionalNotes.trim() || null
    }, [additionalNotes])

    const handleSubmit = async () => {
      if (!isAuthenticated) {
        saveAppointmentDraft({
          currentStep,
          guitarSelectionMode,
          selectedSavedBuildId,
          homeServiceOption,
          homeServiceAddressId,
          homeServiceContact,
          selectedServiceIds,
          guitarDetails,
          selectedDateId,
          selectedTime,
          selectedPaymentMethod,
          additionalNotes,
        })
        pendingSubmitRef.current = true
        openLogin()
        return
      }

      if (!canProceed()) {
        if (!selectedPaymentMethod) {
          setPaymentValidationError('Please select a payment method.')
        } else if ((selectedPaymentMethod === 'e_wallet' || selectedPaymentMethod === 'e_bank') && !paymentProofFile) {
          setPaymentValidationError('Payment proof is required for the selected payment method.')
        } else {
          setPaymentValidationError('Please complete all required booking fields.')
        }
        return
      }

      setPaymentValidationError('')
      setIsSubmittingBooking(true)
      
      try {
        // Validate: reschedule must select a different date/time
        if (isRescheduleMode && rescheduleData.scheduled_at) {
          const oldDate = new Date(rescheduleData.scheduled_at)
          const oldDateId = formatLocalDateId(oldDate)
          const oldTimeHour = oldDate.getHours()
          const oldTimeMin = oldDate.getMinutes()
          const oldTimeLabel = oldDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          
          if (selectedDateId === oldDateId && selectedTime === oldTimeLabel) {
            toast.error('Please select a different date or time than the original appointment schedule.')
            setIsSubmittingBooking(false)
            return
          }
        }

        let serviceReferenceImageUrl = ''
        let guitarReferenceImageUrl = ''
        let paymentProofImageUrl = ''
        const guitarsPayload = selectedGuitarEntries.map(({ details, ...rest }) => rest)
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
        if (paymentProofFile) {
          paymentProofImageUrl = await uploadToCloudinary(paymentProofFile, {
            folder: 'cosmoscraft/appointments/payment-proof',
          })
        }

        const [timeStr, modifier] = selectedTime.split(' ');
        let [hours, minutes] = timeStr.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        const scheduledAt = new Date(`${selectedDateId}T${hours.toString().padStart(2, '0')}:${minutes}:00`);

        // Build notes: only the additional notes + reference image URLs
        const finalNotes = [
          additionalNotes.trim(),
          serviceReferenceImageUrl ? `Service reference image: ${serviceReferenceImageUrl}` : '',
          guitarReferenceImageUrl ? `Guitar reference image: ${guitarReferenceImageUrl}` : '',
        ].filter(Boolean).join('\n') || null

        // Only home service collects a contact number on Step 4. Send it only when
        // it is a valid PH mobile so legacy profile formats never block a booking.
        const appointmentContactNumber = selectedAppointmentType === 'service_home'
          ? normalizePhoneForSubmit(homeServiceContact)
          : undefined

        if (isRescheduleMode) {
          // Update existing appointment (reschedule)
          const response = await fetch(`${API}/api/appointments/${rescheduleData.appointment_id}`, {
            method: 'PATCH',
            headers: getAuthHeaders({
              'Content-Type': 'application/json'
            }),
            credentials: 'include',
            body: JSON.stringify({
              scheduled_at: scheduledAt.toISOString(),
              appointment_type: selectedAppointmentType,
              services: selectedServiceIds,
              location_id: selectedBranchId,
              guitar_details: hasSelectedGuitar
                ? {
                    brand: selectedPrimaryGuitar?.brand || '',
                    model: selectedPrimaryGuitar?.model || '',
                    type: selectedPrimaryGuitar?.type || 'electric',
                    serial: selectedPrimaryGuitar?.serial || 'N/A',
                    notes: selectedPrimaryGuitar?.notes || '',
                    guitars: guitarsPayload,
                  }
                : undefined,
              payment_method: selectedPaymentMethod,
              contact_number: appointmentContactNumber,
              notes: finalNotes,
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to reschedule appointment');
          }

          setShowBookingSuccess(true)
          clearAppointmentDraft()
          setTimeout(() => {
            setShowBookingSuccess(false)
            setIsSubmittingBooking(false)
            navigate('/dashboard', { state: { section: 'appointments', message: 'Appointment rescheduled successfully!' } })
          }, 2000)
        } else {
          // Create new appointment
          const response = await fetch(`${API}/api/appointments`, {
            method: 'POST',
            headers: getAuthHeaders({
              'Content-Type': 'application/json'
            }),
            credentials: 'include',
            body: JSON.stringify({
              appointment_type: selectedAppointmentType,
              services: selectedServiceIds,
              location_id: selectedBranchId,
              address_id: selectedAppointmentType === 'service_home' ? homeServiceAddressId : undefined,
              contact_number: appointmentContactNumber,
              payment_method: selectedPaymentMethod,
              payment_proof_url: paymentProofImageUrl || undefined,
              guitar_details: hasSelectedGuitar
                ? {
                    brand: selectedPrimaryGuitar?.brand || '',
                    model: selectedPrimaryGuitar?.model || '',
                    type: selectedPrimaryGuitar?.type || 'electric',
                    serial: selectedPrimaryGuitar?.serial || 'N/A',
                    notes: selectedPrimaryGuitar?.notes || '',
                    guitars: guitarsPayload,
                  }
                : undefined,
              scheduled_at: scheduledAt.toISOString(),
              notes: finalNotes,
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to create appointment');
          }

          setShowBookingSuccess(true)
          clearAppointmentDraft()
          setTimeout(() => {
            setShowBookingSuccess(false)
            setIsSubmittingBooking(false)
            navigate('/dashboard')
          }, 2000)
        }

      } catch (error) {
        console.error('Submission Error:', error);
        setShowBookingSuccess(false)
        setIsSubmittingBooking(false)
        toast.error(`Failed to book appointment: ${error.message}`);
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

    // --- RENDERS ---

    const renderStepContent = () => {
      switch (currentStep) {
        case 1:
          return (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Select Services</h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">Choose one or more professional guitar services. Our calendar availability will automatically adjust based on the expected turnaround times.</p>
              </div>
              
              <div className="space-y-6">
                {renderServiceSelection()}
              </div>

            </motion.div>
          )

        case 3:
          return (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Select Guitar and Service Type</h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">Choose the guitar first, then select Home Service or In-store service.</p>
              </div>
              
              <div className="bg-theme-surface-deep border border-[var(--border)] p-6 rounded-2xl space-y-5">
                {purchasableBuilds.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Guitar Source</label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setGuitarSelectionMode('saved')}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:py-3 sm:text-sm ${guitarSelectionMode === 'saved' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        Saved Guitar Build
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuitarSelectionMode('manual')}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:py-3 sm:text-sm ${guitarSelectionMode === 'manual' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        Manual Guitar Details
                      </button>
                    </div>
                  </div>
                )}

                {guitarSelectionMode === 'saved' && purchasableBuilds.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Select Saved Guitar<span className="text-red-500" style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={selectedSavedBuildId}
                      onChange={(e) => setSelectedSavedBuildId(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                    >
                      <option value="">No selected saved guitar</option>
                      {purchasableBuilds.map((build) => (
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
                      <label className="block text-sm font-medium text-white mb-1.5">Notes / Issue Description</label>
                      <textarea
                        value={guitarDetails.notes}
                        onChange={e => setGuitarDetails({ ...guitarDetails, notes: e.target.value })}
                        className="w-full h-28 px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:border-[#d4af37]"
                          placeholder="Describe the issue or service request"
                        />
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">Manual guitar details are saved directly from the fields above.</p>
                  </>
                )}

                {isAuthenticated ? (
                  <div>
                    <label className="block text-sm font-medium text-white mb-1.5">Home Service <span className="text-red-500" style={{ color: '#ef4444' }}>*</span></label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setHomeServiceOption('yes')}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:py-3 sm:text-sm ${homeServiceOption === 'yes' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        Yes, Home Service
                      </button>
                      <button
                        type="button"
                        onClick={() => setHomeServiceOption('no')}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:py-3 sm:text-sm ${homeServiceOption === 'no' ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        No, In-store Service
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl p-2 bg-[#d4af37]/10 text-[#d4af37]">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-light)]">In-store Service</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Your appointment will be at our Balagtas branch. Home Service is available after signing in - it requires a saved address on your account.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Dedicated Notes section for additional information */}
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl p-2 bg-[#d4af37]/10 text-[#d4af37]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--text-light)]">Additional Notes (Optional)</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Add any extra information such as address landmarks, delivery/service instructions, 
                        or special requests about your guitar.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    className="w-full h-24 px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm resize-none focus:outline-none focus:border-[#d4af37] placeholder:text-[var(--text-muted)]/60"
                    placeholder="e.g. Gate code: 1234, leave guitar at the front desk, please handle with care..."
                    maxLength={500}
                  />
                  <p className="text-right text-xs text-[var(--text-muted)]">{additionalNotes.length}/500</p>
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
                    <p className="text-sm text-[var(--text-muted)]">Select or add the address we should service, plus your contact number.</p>
                  </div>

                  {!isAuthenticated ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                      <p className="text-sm text-amber-200">
                        Home service needs a saved address. Please sign in first, then you can add or edit your address here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <label className="block text-sm font-medium text-white">Service Address <span className="text-red-500" style={{ color: '#ef4444' }}>*</span></label>
                          <div className="flex items-center gap-2">
                            {homeServiceAddressId && (
                              <button
                                type="button"
                                onClick={() => setAddressPanelMode((mode) => (mode === 'edit' ? '' : 'edit'))}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[#d4af37] transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit address
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setAddressPanelMode((mode) => (mode === 'add' ? '' : 'add'))}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#d4af37] hover:text-[#ffe270] transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add new address
                            </button>
                          </div>
                        </div>
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
                        {userAddresses.length === 0 && (
                          <p className="text-xs text-[var(--text-muted)] mt-1.5">
                            You have no saved address yet. Use "Add new address" to create one.
                          </p>
                        )}
                      </div>

                      {addressPanelMode && (
                        <div className="rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4">
                          <p className="text-sm font-semibold text-[var(--text-light)] mb-3">
                            {addressPanelMode === 'edit' ? 'Edit Address' : 'Add New Address'}
                          </p>
                          <AddressForm
                            initialAddress={addressPanelMode === 'edit'
                              ? (userAddresses.find((address) => String(address.address_id) === String(homeServiceAddressId)) || {})
                              : { label: 'Home', country: 'PH', isDefault: userAddresses.length === 0 }}
                            onSubmit={handleSaveAppointmentAddress}
                            onCancel={closeAddressPanel}
                            submitLabel={addressPanelMode === 'edit' ? 'Update Address' : 'Save Address'}
                            isSubmitting={addressFormSaving}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-white mb-1.5">Contact Number <span className="text-red-500" style={{ color: '#ef4444' }}>*</span></label>
                        {!user?.phone && !showPhoneForm && (
                          <div className="mb-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-3 flex items-center justify-between gap-3">
                            <p className="text-sm text-[var(--text-muted)]">
                              Add your phone number for home service delivery updates.
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowPhoneForm(true)}
                              className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-colors"
                            >
                              Add Phone Number
                            </button>
                          </div>
                        )}
                        {showPhoneForm && (
                          <div className="mb-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-4 space-y-3">
                            <p className="text-sm font-semibold text-[var(--text-light)]">Enter Phone Number</p>
                            <input
                              type="tel"
                              inputMode="numeric"
                              autoComplete="tel"
                              value={newPhone}
                              onChange={(e) => {
                                setNewPhone(sanitizePhoneInput(e.target.value))
                                setPhoneError('')
                              }}
                              className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                              placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                              maxLength={13}
                            />
                            {phoneError && (
                              <p className="text-xs text-red-400">{phoneError}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSavePhone}
                                disabled={phoneSaving || !isValidPhoneNumber(newPhone.trim())}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {phoneSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowPhoneForm(false); setNewPhone(''); setPhoneError('') }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--text-muted)] bg-[var(--surface-dark)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {user?.phone || showPhoneForm ? (
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            value={homeServiceContact}
                            onChange={(e) => {
                              const val = sanitizePhoneInput(e.target.value)
                              setHomeServiceContact(val)
                              if (val && !isValidPhoneNumber(val)) {
                                setContactError(PHONE_ERROR_MESSAGE)
                              } else {
                                setContactError('')
                              }
                            }}
                            className="w-full px-4 py-3 bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[#d4af37]"
                            placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                            maxLength={13}
                          />
                        ) : null}
                        {contactError && (
                          <p className="text-xs text-red-400 mt-1">{contactError}</p>
                        )}
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

                  {!isAuthenticated && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
                      <p className="text-xs text-[var(--text-muted)]">
                        You're browsing as a guest. You'll be asked to sign in on the final step to confirm this booking.
                      </p>
                    </div>
                  )}

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

        case 2:
          return (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Select Date and Time</h2>
                <p className="text-sm text-[var(--text-muted)]">Select an available date (Mon-Sat) and time. Sundays, official holidays, and dates the shop has closed are unavailable.</p>
              </div>

              <div className="bg-theme-surface-deep border border-[var(--border)] rounded-2xl p-6 shadow-xl relative">
{/* Calendar header */}
                <div className="mb-6 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      const prev = new Date(currentYear, currentMonth - 1, 1)
                      setCurrentYear(prev.getFullYear())
                      setCurrentMonth(prev.getMonth())
                    }}
                    aria-label="Previous month"
                    className="p-2 rounded-lg bg-[var(--surface-dark)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors border border-[var(--border)]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="flex-1 text-center text-base font-bold text-[var(--text-light)] sm:text-lg">
                    {new Date(currentYear, currentMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>

                  <button
                    onClick={() => {
                      const next = new Date(currentYear, currentMonth + 1, 1)
                      setCurrentYear(next.getFullYear())
                      setCurrentMonth(next.getMonth())
                    }}
                    aria-label="Next month"
                    className="p-2 rounded-lg bg-[var(--surface-dark)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors border border-[var(--border)]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {servicesLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-dark)]/80 backdrop-blur-sm rounded-2xl z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
                      <p className="text-sm text-[var(--text-muted)]">Loading calendar...</p>
                    </div>
                  </div>
                )}

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
                      // Red is reserved for a date the shop actively closed.
                      // Sundays, holidays, past dates and dates beyond the
                      // booking window are simply not bookable, so they stay
                      // grey — matching the legend under the grid.
                      const isClosedByShop = !day.isPastDate && day.isUnavailableDate
                      const blockedLabel = day.isUnavailableDate
                        ? 'Unavailable — the shop has closed bookings for this date'
                        : day.isHolidayDate
                          ? 'Unavailable — holiday'
                          : day.isPastDate
                            ? 'Unavailable — date has passed'
                            : 'Unavailable — not a working day'

                      if (isUnavailable) {
                        const disabledStyle = isClosedByShop
                          ? 'text-[#FF3737]/80 bg-[#FF3737]/10 border border-[#FF3737]/20'
                          : 'text-[var(--text-muted)]/70 bg-[var(--surface-elevated)]/80 border border-[var(--border)]'

                        return (
                          <div
                            key={day.id}
                            title={blockedLabel}
                            aria-label={`${day.dayNumber} - ${blockedLabel}`}
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

                {/* Legend: why a date is unavailable */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#08CB00]" />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#FF3737]/20 border border-[#FF3737]/40" />
                    Unavailable
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[var(--surface-elevated)] border border-[var(--border)]" />
                    Closed / Non-Working Day
                  </span>
                </div>

                {/* Time Slots */}
                {selectedDateId && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-4 sm:pt-6 border-t border-[var(--border)]">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--text-muted)] mb-3 sm:mb-4 uppercase tracking-wider">Available Time Slots</h3>
                    {slotsLoading && (
                      <p className="mb-3 text-xs text-[var(--text-muted)]">Checking time availability</p>
                    )}
                    {!slotsLoading && Number.isFinite(dailyAppointmentLoad?.reserved) && (
                      <p className="mb-3 text-xs text-[var(--text-muted)]">
                        {dailyAppointmentLoad.reserved} appointment{dailyAppointmentLoad.reserved === 1 ? '' : 's'} reserved on this day
                        {Number.isFinite(dailyAppointmentLoad.capacity) ? ` (${dailyAppointmentLoad.capacity} daily capacity)` : ''}
                      </p>
                    )}
                    {!slotsLoading && slotAvailabilityStatus === 'fully_booked' && (
                      <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                        Fully Booked: This date has reached its current appointment capacity.
                      </p>
                    )}
                    {!slotsLoading && slotAvailabilityStatus === 'unavailable' && (
                      <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                        This date is unavailable for booking.
                      </p>
                    )}
                    {!slotsLoading && !hasAvailableTimeSlots && (
                      <p className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                        No available time slots.
                      </p>
                    )}
                    {!slotsLoading && (
                      <div className="overflow-x-auto pb-1.5 -mx-1 px-1">
                        <div className="flex min-w-max gap-2 sm:gap-3">
                          {timeSlots.map(time => {
                            const isSelected = selectedTime === time
                            const isUnavailableTime = !availableTimeSet.has(time.toUpperCase())
                            const isPastTime = selectedDateId && isPastTimeSlot(selectedDateId, time)
                            const isDisabled = isUnavailableTime || slotsLoading || isPastTime
                            return (
                              <button
                                key={time}
                                onClick={() => { if (!isDisabled) setSelectedTime(time) }}
                                disabled={isDisabled}
                                className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-[#d4af37] text-black'
                                    : isDisabled
                                      ? 'bg-[var(--surface-elevated)] text-[var(--text-muted)]/70 border border-[var(--border)] cursor-not-allowed'
                                      : 'bg-[var(--surface-dark)] text-[var(--text-light)] border border-[var(--border)] hover:border-[#d4af37]/30'
                                }`}
                              >
                                {time}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {selectedDateId && selectedTime && (
                <div className="p-4 rounded-xl border transition-all flex items-center gap-3 bg-[#d4af37]/10 border-[#d4af37]/30">
                  <ClockIcon className="w-5 h-5 text-[#d4af37]" />
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">Currently Selected</p>
                    <p className="text-sm font-medium text-[#d4af37]">
                      {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {selectedTime}
                    </p>
                  </div>
                </div>
              )}
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
                <div className="flex items-end justify-between gap-3 border-b border-[var(--border)] pb-4 sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Appointment Date</p>
                    <p className="text-sm font-medium text-[#d4af37] sm:text-lg">
                      {selectedDate?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {selectedTime}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Location</p>
                    <p className="text-sm font-medium text-[var(--text-light)]">
                      {selectedAppointmentType === 'service_home' ? 'Home Service' : currentBranch.name}
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Selected Services</p>
                    {selectedDetailedServices.length >= 2 ? (
                      <div className="space-y-3">
                        <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                          {selectedDetailedServices.map((svc) => (
                            <li key={svc.id} className="flex justify-between gap-3">
                              <span>{svc.name}</span>
                              <span className="text-[var(--text-light)]">₱{svc.price}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2">
                          <span className="text-sm text-[var(--text-light)]">{selectedDetailedServices.length} services selected</span>
                          <span className="text-sm font-semibold text-[#d4af37]">₱{totalPrice}</span>
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {selectedDetailedServices.map((svc) => (
                          <li key={svc.id} className="flex justify-between text-sm">
                            <span className="text-[var(--text-light)]">{svc.name}</span>
                            <span className="text-[#d4af37]">₱{svc.price}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Guitar Details</p>
                    <div className="space-y-1 text-sm bg-[var(--surface-dark)] p-3 rounded-lg border border-[var(--border)]">
                      {selectedGuitarEntries.length > 0 ? (
                        selectedGuitarEntries.map((guitar, index) => (
                          <div key={`${guitar.brand}-${guitar.model}-${index}`} className={index > 0 ? 'pt-2 mt-2 border-t border-[var(--border)]' : ''}>
                            <p><span className="text-[var(--text-muted)]">Guitar {index + 1}:</span> <span className="text-[var(--text-light)]">{guitar.brand} {guitar.model}</span></p>
                            <p><span className="text-[var(--text-muted)]">Type:</span> <span className="text-[var(--text-light)]">{formatAppointmentGuitarTypeLabel(guitar.type)}</span></p>

                            {guitar.details?.length > 0 ? (
                              <>
                                <dl className="mt-2 max-h-[17rem] overflow-y-auto overscroll-contain divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-3">
                                  {guitar.details.map((item, i) => (
                                    <div key={`${item.label}-${i}`} className="flex items-start justify-between gap-4 py-1.5 text-xs">
                                      <dt className="shrink-0 text-[var(--text-muted)]">{item.label}</dt>
                                      <dd className="text-right font-medium text-[var(--text-light)]">{item.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                                {guitar.details.length > 5 && (
                                  <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                                    Showing 5 of {guitar.details.length} specs. Scroll to see more.
                                  </p>
                                )}
                              </>
                            ) : guitar.notes ? (
                              <p><span className="text-[var(--text-muted)]">Notes:</span> <span className="text-[var(--text-light)]">{guitar.notes}</span></p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-[var(--text-muted)]">No guitar selected</p>
                      )}
                      {selectedAppointmentType === 'service_home' && (
                        <>
                          <p><span className="text-[var(--text-muted)]">Address:</span> <span className="text-[var(--text-light)]">{userAddresses.find((a) => a.address_id === homeServiceAddressId)?.street_line1 || 'Not selected'}</span></p>
                          <p><span className="text-[var(--text-muted)]">Contact:</span> <span className="text-[var(--text-light)]">{homeServiceContact || 'Not provided'}</span></p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {computedNotes && (
                  <div className="border-t border-[var(--border)] pt-4">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Additional Notes</p>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                      <p className="text-sm text-[var(--text-light)] whitespace-pre-wrap">{computedNotes}</p>
                    </div>
                  </div>
                )}

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

                <div className="border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Payment Method <span className="text-red-500" style={{ color: '#ef4444' }}>*</span></p>
                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-3">
                      {PAYMENT_METHODS.slice(0, 3).map((method) => {
                        const isSelected = selectedPaymentMethod === method.value
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => {
                              setSelectedPaymentMethod(method.value)
                              setPaymentProofFile(null)
                              setPaymentProofPreviewUrl('')
                              setPaymentValidationError('')
                              setShowGcashQr(true)
                            }}
                            className={`flex min-h-[92px] w-[228px] shrink-0 flex-col justify-center rounded-xl border-2 p-3 text-left transition-all ${
                              isSelected
                                ? 'border-[#d4af37] bg-[#d4af37]/10'
                                : 'border-[var(--border)] bg-[var(--surface-dark)] hover:border-[#d4af37]/30'
                            }`}
                          >
                            <p className={`text-xs font-semibold ${isSelected ? 'text-[#d4af37]' : 'text-[var(--text-light)]'}`}>
                              {method.label}
                            </p>
                            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">{method.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedPaymentMethod === 'e_wallet' && (
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-light)]">GCash Payment</p>
                      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3">
                        <img
                          src={paymentSettings?.qr_image_url || FALLBACK_QR}
                          alt="GCash QR code"
                          className="mx-auto h-auto max-h-60 w-full max-w-[220px] object-contain"
                          onError={() => setShowGcashQr(false)}
                        />
                      </div>
                      {!showGcashQr && (
                        <p className="text-xs text-red-400">GCash payment image is unavailable. Please ask admin for updated QR details.</p>
                      )}
                      <p className="text-xs text-[var(--text-muted)]">Scan the QR code in your GCash app and then upload the payment proof below.</p>
                    </div>
                  )}

                  {selectedPaymentMethod === 'e_bank' && (
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-light)]">Bank Transfer Details</p>
                      {paymentSettings?.bank_transfer_display_mode === 'qr' && paymentSettings?.bank_transfer_qr_image_url && (
                        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3">
                          <img
                            src={paymentSettings.bank_transfer_qr_image_url}
                            alt="Bank transfer QR code"
                            className="mx-auto h-auto max-h-60 w-full max-w-[220px] object-contain"
                          />
                        </div>
                      )}
                      {(paymentSettings?.bank_transfer_display_mode !== 'qr' || !paymentSettings?.bank_transfer_qr_image_url) && (
                      <div className="space-y-2 text-xs text-[var(--text-muted)]">
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                          <span>Bank</span>
                          <span className="font-medium text-[var(--text-light)]">{paymentSettings?.bank_name || FALLBACK_BANK.bankName}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
                          <span>Account Name</span>
                          <span className="font-medium text-[var(--text-light)]">{paymentSettings?.account_name || FALLBACK_BANK.accountName}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Account Number</span>
                          <span className="font-medium text-[var(--text-light)]">{paymentSettings?.account_number || FALLBACK_BANK.accountNumber}</span>
                        </div>
                      </div>
                      )}
                    </div>
                  )}

                  {(selectedPaymentMethod === 'e_wallet' || selectedPaymentMethod === 'e_bank') && (
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-light)]">Upload Payment Proof <span className="text-red-500" style={{ color: '#ef4444' }}>*</span></p>
                      <p className="text-xs text-[var(--text-muted)]">Please upload a screenshot or photo of your payment transaction/receipt as proof of payment.</p>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-light)] hover:border-[#d4af37]/50 hover:text-[#d4af37] transition-colors">
                        <ImagePlus className="h-4 w-4" />
                        {paymentProofFile ? 'Change Payment Proof' : 'Upload Payment Proof'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePaymentProofChange}
                        />
                      </label>
                      {paymentProofPreviewUrl && (
                        <div className="rounded-xl border border-[var(--border)] bg-theme-surface-deep p-3">
                          <img src={paymentProofPreviewUrl} alt="Payment proof" className="h-40 w-full rounded-lg object-cover" />
                          <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span>{paymentProofFile?.name || 'payment-proof'}</span>
                            <button
                              type="button"
                              onClick={clearPaymentProof}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 hover:border-red-400/60 hover:text-red-300 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentValidationError && (
                    <p className="mt-3 text-sm font-medium text-red-400">{paymentValidationError}</p>
                  )}
                </div>
              </div>

            </motion.div>
          )

        default:
          return null
      }
    }

    return (
      <div className="min-h-screen pt-16 bg-[var(--bg-primary)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10">
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4 sm:gap-6 lg:gap-8 xl:gap-12 min-h-[600px]">
            
            {/* LEFT SIDEBAR (STEPPER) */}
            <div className="hidden xl:flex bg-theme-surface-deep border border-[var(--border)] rounded-3xl p-5 sm:p-8 relative overflow-hidden flex-col justify-between">
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
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                {currentStep < 5 && !canProceed() && (
                  <p className="mb-3 text-xs sm:text-sm font-medium text-red-400" style={{ color: '#f87171' }}>{getStepValidationMessage()}</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={handlePrevStep}
                    disabled={currentStep === 1 || isSubmittingBooking}
                    className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-[var(--text-light)] bg-[var(--surface-dark)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-light)] transition-colors disabled:opacity-0"
                  >
                    Back
                  </button>

                  {currentStep < 5 ? (
                    <button
                      onClick={handleNextStep}
                      disabled={!canProceed()}
                      className="px-7 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#d4af37]/10"
                    >
                      Next
                    </button>
                  ) : !isAuthenticated ? (
                      <button
                        onClick={() => {
                          saveAppointmentDraft({
                            currentStep: 5,
                            guitarSelectionMode,
                            selectedSavedBuildId,
                            homeServiceOption,
                            homeServiceAddressId,
                            homeServiceContact,
                            selectedServiceIds,
                            guitarDetails,
                            selectedDateId,
                            selectedTime,
                            selectedPaymentMethod,
                            additionalNotes,
                          })
                          pendingSubmitRef.current = true
                          openLogin()
                        }}
                        className="px-6 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center gap-2"
                      >
                        Sign in to Complete
                      </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmittingBooking || !canProceed()}
                      className="px-6 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#d4af37] text-black hover:bg-[#ffe270] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] shadow-[#d4af37]/20 flex items-center gap-2"
                    >
                      {isSubmittingBooking ? (
                        <>Processing... <Settings className="w-4 h-4 animate-spin" /></>
                      ) : isRescheduleMode ? (
                        "Update Appointment"
                      ) : (
                        "Complete Booking"
                      )}
                    </button>
                  )}
                </div>

                <div className="mt-3 text-center text-[10px] sm:text-xs text-[var(--text-muted)] xl:hidden">
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