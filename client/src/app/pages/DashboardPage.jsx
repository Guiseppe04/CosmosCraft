import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { User, CreditCard, MapPin, Lock, Package, Calendar, ChevronRight, ChevronLeft, Search, Upload, Save, Wallet, ShoppingBag, ShoppingCart, Trash2, Minus, Plus, MessageSquare, Send, Guitar, Clock, Truck, CheckCircle, XCircle, Briefcase, Activity, Star, Loader2, Edit, AlertCircle, AlertTriangle, X, Banknote, Smartphone, Landmark, CreditCard as CreditCardIcon, Check, RefreshCw, Printer, Info, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { BASE_PRICE, BODY_OPTIONS, BODY_WOOD_OPTIONS, BODY_FINISH_OPTIONS, NECK_OPTIONS, FRETBOARD_OPTIONS, HEADSTOCK_OPTIONS, HEADSTOCK_WOOD_OPTIONS, INLAY_OPTIONS, BRIDGE_OPTIONS, PICKGUARD_OPTIONS_BY_BODY, KNOB_OPTIONS_BY_BODY, HARDWARE_OPTIONS, PICKUP_OPTIONS } from '../lib/guitarBuilderData.js'
import { adminApi } from '../utils/adminApi.js'
import { buildInvoiceHtml } from '../utils/invoiceBuilder.js'
import { formatPaymentMethod } from '../utils/paymentMethodUtils'
import { getPaymentStatusConfig } from '../utils/orderPaymentStatus'
import { useDebounce } from '../hooks/useDebounce'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import CustomerProjectTracker from '../components/projects/CustomerProjectTracker.jsx'
import { AddressForm } from '../components/AddressForm.jsx'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import { Country } from 'country-state-city'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { SelectableCartItemRow } from '../components/cart/SelectableCartItemRow.jsx'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find(c => c.isoCode === 'PH')
const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => c.isoCode !== 'PH')
const COUNTRIES = PHILIPPINES ? [PHILIPPINES, ...OTHER_COUNTRIES] : ALL_COUNTRIES
const MAX_SAVED_GUITAR_BUILDS = 10
const ORDER_CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Need to change shipping details',
  'Found a better price elsewhere',
  'Payment issue',
  'Others',
]
const APPOINTMENT_CANCEL_REASONS = [
  'Schedule conflict',
  'No longer needed',
  'Found another service provider',
  'Emergency / Personal reason',
  'Vehicle / Transportation issue',
  'Others',
]

const HOLD_REASONS = [
  'Waiting for parts or materials',
  'Need to adjust budget or payment',
  'Personal or schedule conflict',
  'Design change or revision needed',
  'Not ready to proceed yet',
  'Others',
]

const getOldConfigData = (key, val, bodyType) => {
  let price;
  let label = val;
  if (key === 'body') { price = BODY_OPTIONS[val]?.price; label = BODY_OPTIONS[val]?.label; }
  else if (key === 'bodyWood') { price = BODY_WOOD_OPTIONS[val]?.price; label = BODY_WOOD_OPTIONS[val]?.label; }
  else if (key === 'bodyFinish') { price = BODY_FINISH_OPTIONS[val]?.price; label = BODY_FINISH_OPTIONS[val]?.label; }
  else if (key === 'neck') { price = NECK_OPTIONS[val]?.price; label = NECK_OPTIONS[val]?.label; }
  else if (key === 'fretboard') { price = FRETBOARD_OPTIONS[val]?.price; label = FRETBOARD_OPTIONS[val]?.label; }
  else if (key === 'headstock') { price = HEADSTOCK_OPTIONS[val]?.price; label = HEADSTOCK_OPTIONS[val]?.label; }
  else if (key === 'headstockWood') { price = HEADSTOCK_WOOD_OPTIONS[val]?.price; label = HEADSTOCK_WOOD_OPTIONS[val]?.label; }
  else if (key === 'inlays') { price = INLAY_OPTIONS[val]?.price; label = INLAY_OPTIONS[val]?.label; }
  else if (key === 'bridge') { price = BRIDGE_OPTIONS[val]?.price; label = BRIDGE_OPTIONS[val]?.label; }
  else if (key === 'pickguard') { price = PICKGUARD_OPTIONS_BY_BODY[bodyType]?.[val]?.price; label = PICKGUARD_OPTIONS_BY_BODY[bodyType]?.[val]?.label; }
  else if (key === 'knobs') { price = KNOB_OPTIONS_BY_BODY[bodyType]?.[val]?.price; label = KNOB_OPTIONS_BY_BODY[bodyType]?.[val]?.label; }
  else if (key === 'hardware') { price = HARDWARE_OPTIONS[val]?.price; label = HARDWARE_OPTIONS[val]?.label; }
  else if (key === 'pickups') { price = PICKUP_OPTIONS[val]?.price; label = PICKUP_OPTIONS[val]?.label; }
  return { price, label: label || val };
}

const formatAddress = (addr) => {
  if (!addr) return 'Address'
  const parts = []
  if (addr.street_line1) parts.push(addr.street_line1)
  if (addr.street_line2) parts.push(addr.street_line2)
  if (addr.barangay) parts.push(addr.barangay)
  if (addr.city) parts.push(addr.city)
  if (addr.province) parts.push(addr.province)
  if (addr.postal_code) parts.push(addr.postal_code)
  if (addr.country) parts.push(addr.country)
  return parts.length > 0 ? parts.join(', ') : 'Address'
}

const formatAddressFull = (addr) => {
  if (!addr) return null
  const lines = []
  if (addr.street_line1) lines.push(addr.street_line1)
  if (addr.street_line2) lines.push(addr.street_line2)
  const locationParts = []
  if (addr.barangay) locationParts.push(addr.barangay)
  if (addr.city) locationParts.push(addr.city)
  if (addr.province) locationParts.push(addr.province)
  if (addr.postal_code) locationParts.push(addr.postal_code)
  if (locationParts.length > 0) lines.push(locationParts.join(', '))
  if (addr.country) lines.push(addr.country)
  return lines
}

const formatStatus = (status) => {
  if (!status) return ''
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const REFUND_STATUS_CONFIG = {
  pending: {
    label: 'Refund Request Pending',
    icon: Clock,
    className: 'border-amber-500/30 text-amber-400',
  },
  'pending_payment_verification': {
    label: 'Awaiting Payment Verification',
    icon: Clock,
    className: 'border-violet-500/30 text-violet-400',
  },
  approved: {
    label: 'Refund Approved',
    icon: CheckCircle,
    className: 'border-green-500/30 text-green-400',
  },
  processing: {
    label: 'Refund Processing',
    icon: RefreshCw,
    className: 'border-sky-500/30 text-sky-400',
  },
  rejected: {
    label: 'Refund Rejected',
    icon: XCircle,
    className: 'border-red-500/30 text-red-400',
  },
  refunded: {
    label: 'Refunded',
    icon: CheckCircle,
    className: 'border-sky-500/30 text-sky-400',
  },
  withdrawn: {
    label: 'Refund Withdrawn',
    icon: XCircle,
    className: 'border-slate-500/30 text-slate-400',
  },
  'return_pending': {
    label: 'Return Pending',
    icon: Truck,
    className: 'border-amber-500/30 text-amber-400',
  },
  returned: {
    label: 'Returned',
    icon: CheckCircle,
    className: 'border-sky-500/30 text-sky-400',
  },
  'return_confirmed': {
    label: 'Return Confirmed',
    icon: CheckCircle,
    className: 'border-green-500/30 text-green-400',
  },
}

const getRefundStatusConfig = (status) => REFUND_STATUS_CONFIG[status] || REFUND_STATUS_CONFIG.pending

const parseProjectDescription = (description) => {
  const normalized = String(description || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  const checkoutPrefixMatch = normalized.match(/^Checkout Terms:\s*(.*)$/i)
  if (!checkoutPrefixMatch) {
    return { title: null, bulletItems: [], metaLines: [], plainText: normalized }
  }

  const remainder = checkoutPrefixMatch[1] || ''
  const rawSegments = remainder
    .split(/\s+-\s+/)
    .flatMap((segment) =>
      segment.split(/(?=Terms and Conditions accepted:)|(?=Payment Method:)|(?=Auto-created from custom build payment)/i)
    )
    .map((segment) => segment.trim())
    .filter(Boolean)

  const bulletItems = []
  const metaLines = []

  rawSegments.forEach((segment) => {
    if (
      /^Terms and Conditions accepted:/i.test(segment) ||
      /^Payment Method:/i.test(segment) ||
      /^Auto-created from custom build payment/i.test(segment)
    ) {
      metaLines.push(segment)
      return
    }
    bulletItems.push(segment)
  })

  return {
    title: 'Checkout Terms',
    bulletItems,
    metaLines,
    plainText: '',
  }
}

const formatEstimatedCompletionDate = (project) => {
  const rawValue = project?.estimated_completion_date || project?.end_date || null
  if (!rawValue) return null
  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString()
}

function DashboardStarRatingDisplay({ rating, maxStars = 5, size = 'w-4 h-4' }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }).map((_, idx) => {
        const starNum = idx + 1
        return (
          <Star
            key={starNum}
            className={`${size} ${
              starNum <= rating
                ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]'
                : 'text-zinc-600 fill-zinc-800'
            }`}
          />
        )
      })}
    </div>
  )
}

function DashboardStarPicker({ rating, onChange, maxStars = 5, size = 'w-7 h-7' }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: maxStars }).map((_, idx) => {
        const starNum = idx + 1
        const active = hovered ? starNum <= hovered : starNum <= rating
        return (
          <button
            key={starNum}
            type="button"
            onClick={() => onChange(starNum)}
            onMouseEnter={() => setHovered(starNum)}
            onMouseLeave={() => setHovered(0)}
            className="p-1 transition-transform hover:scale-115 focus:outline-none cursor-pointer"
          >
            <Star
              className={`${size} transition-colors ${
                active
                  ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                  : 'text-zinc-600 fill-zinc-800 hover:text-zinc-400'
              }`}
            />
          </button>
        )
      })}
      <span className="ml-2 text-sm font-semibold text-[var(--gold-primary)]">
        {(hovered || rating) > 0 ? `${hovered || rating} / 5` : ''}
      </span>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user, updateUser } = useAuth()
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    getTotalPrice,
    getCartCount,
    toggleItemSelection,
    toggleSelectAllItems,
    getSelectedItemIds,
  } = useCart()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const tabFromQuery = queryParams.get('tab') || queryParams.get('orderTab')
  const sectionFromQuery = queryParams.get('section')
  const initialSection = (tabFromQuery && ['ratings', 'ratings-feedback', 'refunds'].includes(tabFromQuery))
    ? 'purchases'
    : (sectionFromQuery === 'orders' ? 'purchases' : (location.state?.section || 'profile'))
  const VALID_SECTIONS = new Set(['profile', 'my-guitar', 'appointments', 'cart', 'purchases', 'addresses', 'password'])
  const [activeSection, setActiveSection] = useState(initialSection)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab') || params.get('orderTab')
    const secParam = params.get('section')
    if (secParam && VALID_SECTIONS.has(secParam)) {
      setActiveSection(secParam)
    } else if (secParam === 'orders') {
      setActiveSection('purchases')
    }
    if (tabParam === 'refunds') {
      setActiveSection('purchases')
      setActivePurchaseTab('Refund')
    } else if (tabParam === 'ratings' || tabParam === 'ratings-feedback') {
      setActiveSection('purchases')
    }
  }, [location.search])
  const [profileImage, setProfileImage] = useState('')
  const [showSelectInstrumentModal, setShowSelectInstrumentModal] = useState(false)
  const [viewingBuild, setViewingBuild] = useState(null)
  const [toastMessage, setToastMessage] = useState(location.state?.message || null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [buildToDelete, setBuildToDelete] = useState(null)

  const [myProjects, setMyProjects] = useState([])
  const [myProjectSearch, setMyProjectSearch] = useState('')
  const [myProjectSort, setMyProjectSort] = useState('updated')
  const [myProjectPage, setMyProjectPage] = useState(1)
  const MY_PROJECTS_PAGE_SIZE = 6
  const [myProjectsPagination, setMyProjectsPagination] = useState({ page: 1, pageSize: 6, total: 0, totalPages: 1 })
  const debouncedMyProjectSearch = useDebounce(myProjectSearch, 300)
  const [myCustomizations, setMyCustomizations] = useState([])
  const [activeProjectView, setActiveProjectView] = useState(null)
  const [activeBuildTab, setActiveBuildTab] = useState('build-projects')

  const [myOrders, setMyOrders] = useState([])
  const [activePurchaseTab, setActivePurchaseTab] = useState('All')
  const [isCancelOrderModalOpen, setIsCancelOrderModalOpen] = useState(false)
  const [cancelOrderTarget, setCancelOrderTarget] = useState(null)
  const [cancelOrderReason, setCancelOrderReason] = useState('')
  const [cancelOrderCustomReason, setCancelOrderCustomReason] = useState('')
  const [isCancellingOrder, setIsCancellingOrder] = useState(false)

  // Received / Refund state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [refundTarget, setRefundTarget] = useState(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundCustomerNotes, setRefundCustomerNotes] = useState('')
  const [refundSelectedItems, setRefundSelectedItems] = useState([])
  const [refundImages, setRefundImages] = useState([])
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)
  const [isMarkingReceived, setIsMarkingReceived] = useState(false)
  const [printingOrderId, setPrintingOrderId] = useState(null)

  // Inline Review / Feedback modal state
  const [reviewModal, setReviewModal] = useState(null) // { mode: 'rate'|'edit'|'view', order, item, review }
  const [feedbackModal, setFeedbackModal] = useState(null) // { mode: 'leave'|'edit'|'view', order, feedback }
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '', images: [] })
  const [feedbackForm, setFeedbackForm] = useState({ overall_rating: 5, build_quality_rating: 5, communication_rating: 5, accuracy_rating: 5, comment: '', images: [] })
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [uploadingReviewImage, setUploadingReviewImage] = useState(false)
  const [isCancelProjectModalOpen, setIsCancelProjectModalOpen] = useState(false)
  const [cancelProjectTarget, setCancelProjectTarget] = useState(null)
  const [cancelProjectPayment, setCancelProjectPayment] = useState(null)
  const [cancelProjectPaymentLoading, setCancelProjectPaymentLoading] = useState(false)
  const [isCancellingProject, setIsCancellingProject] = useState(false)
  const [cancelProjectConfirmed, setCancelProjectConfirmed] = useState(false)
  // Build state preview for claim flow
  const [cancelBuildPreview, setCancelBuildPreview] = useState(null)
  const [cancelBuildPreviewLoading, setCancelBuildPreviewLoading] = useState(false)
  const [cancelClaimMethod, setCancelClaimMethod] = useState('pickup')
  const [cancelClaimRecipientName, setCancelClaimRecipientName] = useState('')
  const [cancelClaimRecipientContact, setCancelClaimRecipientContact] = useState('')
  const [cancelClaimDeliveryInstructions, setCancelClaimDeliveryInstructions] = useState('')

  // Hold / Cancel with options state
  const [isHoldProjectModalOpen, setIsHoldProjectModalOpen] = useState(false)
  const [holdProjectTarget, setHoldProjectTarget] = useState(null)
  const [holdOption, setHoldOption] = useState('resume_later')
  const [holdReason, setHoldReason] = useState('')
  const [holdCustomReason, setHoldCustomReason] = useState('')
  const [isHoldingProject, setIsHoldingProject] = useState(false)

  const [isCancelWithOptionsModalOpen, setIsCancelWithOptionsModalOpen] = useState(false)
  const [cancelWithOptionsTarget, setCancelWithOptionsTarget] = useState(null)
  const [cancelOption, setCancelOption] = useState('ship_to_address')
  const [cancelWithOptionsReason, setCancelWithOptionsReason] = useState('')
  const [cancelWithOptionsConfirmed, setCancelWithOptionsConfirmed] = useState(false)
  const [selectedCancelAddressId, setSelectedCancelAddressId] = useState(null)
  const [isAddingCancelAddress, setIsAddingCancelAddress] = useState(false)
  const [cancelAddressSuccessMsg, setCancelAddressSuccessMsg] = useState('')
  const [isSavingCancelAddress, setIsSavingCancelAddress] = useState(false)
  const [isWithdrawingCancelRequest, setIsWithdrawingCancelRequest] = useState(false)
  const [isCancellingWithOptions, setIsCancellingWithOptions] = useState(false)

  // Resume / Continue Build state
  const [isResumeProjectModalOpen, setIsResumeProjectModalOpen] = useState(false)
  const [resumeProjectTarget, setResumeProjectTarget] = useState(null)
  const [isResumingProject, setIsResumingProject] = useState(false)

  const [myAppointments, setMyAppointments] = useState([])
  const [appointmentSort, setAppointmentSort] = useState('soonest')
  const [reschedulingAptId, setReschedulingAptId] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [isCancelAppointmentModalOpen, setIsCancelAppointmentModalOpen] = useState(false)
  const [cancelAppointmentTarget, setCancelAppointmentTarget] = useState(null)
  const [cancelAppointmentReason, setCancelAppointmentReason] = useState('')
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false)
  const [isPaymentConfirmedModalOpen, setIsPaymentConfirmedModalOpen] = useState(false)
  const [isRequestRefundModalOpen, setIsRequestRefundModalOpen] = useState(false)
  const [isRequestingRefund, setIsRequestingRefund] = useState(false)

  const DIGITAL_PAYMENT_METHODS = ['gcash', 'e_wallet', 'e_bank', 'bank_transfer']
  const isDigitalPayment = (method) => DIGITAL_PAYMENT_METHODS.includes(method?.toLowerCase())
  const isPaymentConfirmed = (status) => {
    const normalized = (status || 'pending').toLowerCase()
    return ['verified', 'approved', 'paid'].includes(normalized)
  }

  const [ratingModalOrderId, setRatingModalOrderId] = useState(null)
  const [rating, setRating] = useState(0)
  const [ratingText, setRatingText] = useState('')

  useEffect(() => {
    const sectionFromState = location.state?.section
    if (!sectionFromState) return
    setActiveSection(VALID_SECTIONS.has(sectionFromState) ? sectionFromState : 'profile')
  }, [location.state])

  useEffect(() => {
    if (!VALID_SECTIONS.has(activeSection)) {
      setActiveSection('profile')
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'purchases') {
      fetchMyOrders()
    }
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'appointments') {
      fetchMyAppointments()
    }
  }, [activeSection, user?.id])

  useEffect(() => {
    if (activeSection === 'my-guitar') {
      fetchMyProjects()
      fetchMyCustomizations()
    }
  }, [activeSection])

  useEffect(() => {
    setMyProjectPage(1)
  }, [myProjectSearch, myProjectSort])

  useEffect(() => {
    fetchMyProjects()
  }, [myProjectPage, myProjectSort, debouncedMyProjectSearch, user?.id])

  useEffect(() => {
    if (activeSection !== 'password') {
      setPasswordError('')
      setPasswordSuccessMessage('')
      setIsPasswordConfirmOpen(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    }
  }, [activeSection])

  const fetchMyAppointments = () => {
    if (!user?.id) {
      setMyAppointments([])
      return
    }

    adminApi.getUserAppointments(user.id)
      .then(res => setMyAppointments(res.data?.appointments || []))
      .catch(console.error)
  }

  const fetchMyOrders = () => {
    adminApi.getMyOrders().then(res => setMyOrders(res.data?.orders || [])).catch(console.error)
  }

  const printCustomerInvoice = async (order) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    setPrintingOrderId(order.order_id)
    try {
      const fullOrder = await adminApi.getOrder(order.order_id)
      const receiptHtml = buildInvoiceHtml(fullOrder.data?.order || fullOrder.data || order)
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'

      const cleanup = () => {
        window.setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
        }, 250)
      }

      iframe.onload = () => {
        const frameWindow = iframe.contentWindow
        if (!frameWindow) { cleanup(); return }
        const handleAfterPrint = () => {
          frameWindow.removeEventListener('afterprint', handleAfterPrint)
          cleanup()
        }
        frameWindow.addEventListener('afterprint', handleAfterPrint)
        frameWindow.focus()
        window.setTimeout(() => {
          try { frameWindow.print() } catch { handleAfterPrint() }
        }, 150)
      }

      document.body.appendChild(iframe)
      const frameDocument = iframe.contentDocument || iframe.contentWindow?.document
      if (!frameDocument) { cleanup(); return }
      frameDocument.open()
      frameDocument.write(receiptHtml)
      frameDocument.close()
    } catch (error) {
      console.error('Failed to load order for invoice:', error)
    } finally {
      setPrintingOrderId(null)
    }
  }

  const fetchMyProjects = () => {
    adminApi.getMyProjects({ search: debouncedMyProjectSearch, sort_by: ({ updated: 'updated_at', created: 'created_at', name: 'project_name' })[myProjectSort] || 'updated_at', sort_dir: 'desc', page: myProjectPage, page_size: MY_PROJECTS_PAGE_SIZE, include_tasks: true })
      .then(res => {
        setMyProjects(res.data)
        setMyProjectsPagination(res.pagination || { page: 1, pageSize: MY_PROJECTS_PAGE_SIZE, total: 0, totalPages: 1 })
      })
      .catch(console.error)
  }

  const fetchMyCustomizations = () => {
    adminApi.getMyCustomizations().then(res => setMyCustomizations(res.data || [])).catch(console.error)
  }

  const customizationLookup = useMemo(
    () => new Map(myCustomizations.map(customization => [customization.customization_id, customization])),
    [myCustomizations]
  )

  const projectLookupByCustomization = useMemo(() => {
    const nextLookup = new Map()

    for (const project of myProjects) {
      for (const customizationId of project.customization_ids || []) {
        if (customizationId && !nextLookup.has(customizationId)) {
          nextLookup.set(customizationId, project)
        }
      }
    }

    return nextLookup
  }, [myProjects])

  const getBuildCustomizationId = (build) =>
    build?.dbCustomizationId || build?.customization_id || null

  const getBuildLockState = (build) => {
    const customizationId = getBuildCustomizationId(build)
    const customization = customizationId ? customizationLookup.get(customizationId) : null
    const rawProject = customizationId ? projectLookupByCustomization.get(customizationId) : null
    const project = rawProject && String(rawProject.status || '').toLowerCase() !== 'cancelled'
      ? rawProject
      : null

    return {
      customizationId,
      customization,
      project,
      isLocked: Boolean(customization?.is_locked || project),
    }
  }

  const handleLockedBuildAction = () => {
    setToastMessage('This build is already in an active order. You can track it in My Guitar, but you can no longer edit or order it again.')
  }

  const submitRating = () => {
    setToastMessage('Thank you for rating this product!');
    setRatingModalOrderId(null);
    setRating(0);
    setRatingText('');
  };

  const handleBuyAgain = async (orderId) => {
    try {
      const res = await adminApi.getOrder(orderId)
      const items = res.data?.order?.items || res.data?.items || []
      if (items && items.length > 0) {
        items.forEach(item => {
          addToCart({
            id: item.product_id || item.product_sku || `prod-${Date.now()}`,
            name: item.product_name || item.name || 'Product',
            price: Number(item.unit_price || item.price || 0),
            quantity: item.quantity || 1,
            image: item.image_url || item.image || null,
          })
        })
        showToast('Items added to cart!')
      } else {
        showToast('No items available to reorder.', 'error')
      }
    } catch (err) {
      showToast(`Failed to load order: ${err.message}`, 'error')
    }
  }

  const openCancelOrderModal = (order) => {
    setCancelOrderTarget(order)
    setCancelOrderReason('')
    setCancelOrderCustomReason('')
    setIsCancelOrderModalOpen(true)
  }

  const closeCancelOrderModal = (force = false) => {
    if (isCancellingOrder && !force) return
    setIsCancelOrderModalOpen(false)
    setCancelOrderTarget(null)
    setCancelOrderReason('')
    setCancelOrderCustomReason('')
  }

  const getResolvedCancelReason = () => {
    if (cancelOrderReason === 'Others') return cancelOrderCustomReason.trim()
    return cancelOrderReason
  }

  const handleCancelOrder = async () => {
    const resolvedReason = getResolvedCancelReason()
    if (!cancelOrderTarget?.order_id || !resolvedReason) {
      return
    }
    try {
      setIsCancellingOrder(true)
      await adminApi.cancelMyOrder(cancelOrderTarget.order_id, resolvedReason);
      setToastMessage('Order has been cancelled.');
      fetchMyOrders();
      closeCancelOrderModal(true)
    } catch (err) {
      setToastMessage(`Failed to cancel order: ${err.message}`);
    } finally {
      setIsCancellingOrder(false)
    }
  };

  const handleMarkAsReceived = async (order) => {
    if (!order?.order_id) return
    try {
      setIsMarkingReceived(true)
      await adminApi.markAsReceived(order.order_id)
      setToastMessage('Order marked as received.')
      fetchMyOrders()
    } catch (err) {
      setToastMessage(`Failed to mark as received: ${err.message}`)
    } finally {
      setIsMarkingReceived(false)
    }
  }

  const openRefundModal = (order) => {
    setRefundTarget(order)
    setRefundReason('')
    setRefundCustomerNotes('')
    const selectableItems = (order.items || []).map(item => ({
      order_item_id: item.order_item_id,
      product_name: item.product_name || 'Product',
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      selected: false,
      refundQuantity: Number(item.quantity || 1),
    }))
    setRefundSelectedItems(selectableItems)
    setRefundImages([])
    setIsRefundModalOpen(true)
  }

  const closeRefundModal = (force = false) => {
    if (isSubmittingRefund && !force) return
    setIsRefundModalOpen(false)
    setRefundTarget(null)
    setRefundReason('')
    setRefundCustomerNotes('')
    setRefundSelectedItems([])
    setRefundImages([])
  }

  const toggleRefundItem = (index) => {
    setRefundSelectedItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], selected: !next[index].selected }
      return next
    })
  }

  const updateRefundQuantity = (index, value) => {
    const qty = Math.max(1, Math.min(Number(value) || 1, refundSelectedItems[index].quantity))
    setRefundSelectedItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], refundQuantity: qty }
      return next
    })
  }

  const handleRefundImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const maxSize = 5 * 1024 * 1024
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setToastMessage('Only JPG, PNG, and WebP images are allowed')
        continue
      }
      if (file.size > maxSize) {
        setToastMessage('Each image must be less than 5MB')
        continue
      }
      try {
        const url = await uploadToCloudinary(file, { folder: 'cosmoscraft_assets/refund_proofs' })
        setRefundImages(prev => [...prev, url])
      } catch (err) {
        setToastMessage(`Failed to upload image: ${err.message}`)
      }
    }
    e.target.value = ''
  }

  const removeRefundImage = (index) => {
    setRefundImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitRefund = async () => {
    if (!refundTarget?.order_id) return
    const selected = refundSelectedItems.filter(item => item.selected)
    if (selected.length === 0) {
      setToastMessage('Please select at least one item to refund')
      return
    }
    if (!refundReason.trim()) {
      setToastMessage('Please provide a refund reason')
      return
    }
    try {
      setIsSubmittingRefund(true)
      await adminApi.createRefundRequest(refundTarget.order_id, {
        reason: refundReason.trim(),
        customerNotes: refundCustomerNotes.trim() || undefined,
        items: selected.map(item => ({
          order_item_id: item.order_item_id,
          quantity: item.refundQuantity,
        })),
        images: refundImages,
      })
      setToastMessage('Refund request submitted successfully.')
      closeRefundModal(true)
      fetchMyOrders()
    } catch (err) {
      setToastMessage(`Failed to submit refund request: ${err.message}`)
    } finally {
      setIsSubmittingRefund(false)
    }
  }

  // Handle Photo Upload for Product Review / Customization Feedback
  const handleReviewImageUpload = async (e, type) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const maxSize = 5 * 1024 * 1024
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    setUploadingReviewImage(true)
    try {
      const uploadedUrls = []
      for (const file of files.slice(0, 3)) {
        if (!allowedTypes.includes(file.type)) {
          setToastMessage('Only JPG, PNG, and WebP images are allowed')
          continue
        }
        if (file.size > maxSize) {
          setToastMessage('Each image must be less than 5MB')
          continue
        }
        const url = await uploadToCloudinary(file, { folder: 'cosmoscraft_reviews' })
        uploadedUrls.push(url)
      }

      if (type === 'product') {
        setReviewForm(prev => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 5),
        }))
      } else {
        setFeedbackForm(prev => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 5),
        }))
      }
      if (uploadedUrls.length > 0) {
        setToastMessage('Photo uploaded successfully!')
      }
    } catch (err) {
      console.error('Image upload failed:', err)
      setToastMessage('Failed to upload image. Please try again.')
    } finally {
      setUploadingReviewImage(false)
      e.target.value = ''
    }
  }

  const removeReviewImage = (index, type) => {
    if (type === 'product') {
      setReviewForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
    } else {
      setFeedbackForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
    }
  }

  const handleSubmitProductReview = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!reviewForm.comment.trim()) {
      setToastMessage('Please provide a review comment.')
      return
    }
    if (!reviewModal) return

    setIsSubmittingReview(true)
    try {
      if (reviewModal.mode === 'edit' && reviewModal.review?.review_id) {
        await adminApi.updateProductReview(reviewModal.review.review_id, {
          rating: reviewForm.rating,
          title: reviewForm.title.trim(),
          comment: reviewForm.comment.trim(),
          images: reviewForm.images,
        })
        setToastMessage('Review updated successfully!')
      } else {
        await adminApi.createProductReview({
          order_id: reviewModal.order?.order_id,
          order_item_id: reviewModal.item?.order_item_id,
          rating: reviewForm.rating,
          title: reviewForm.title.trim(),
          comment: reviewForm.comment.trim(),
          images: reviewForm.images,
        })
        setToastMessage('Thank you! Your review was submitted successfully.')
      }
      setReviewModal(null)
      fetchMyOrders()
    } catch (err) {
      console.error('Failed to submit product review:', err)
      setToastMessage(err.message || 'Failed to submit review.')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const handleSubmitCustomFeedback = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!feedbackForm.comment.trim()) {
      setToastMessage('Please provide your feedback comments.')
      return
    }
    if (!feedbackModal) return

    setIsSubmittingReview(true)
    try {
      if (feedbackModal.mode === 'edit' && feedbackModal.feedback?.feedback_id) {
        await adminApi.updateCustomizationFeedback(feedbackModal.feedback.feedback_id, {
          overall_rating: feedbackForm.overall_rating,
          build_quality_rating: feedbackForm.build_quality_rating,
          communication_rating: feedbackForm.communication_rating,
          accuracy_rating: feedbackForm.accuracy_rating,
          comment: feedbackForm.comment.trim(),
          images: feedbackForm.images,
        })
        setToastMessage('Customization feedback updated!')
      } else {
        await adminApi.createCustomizationFeedback({
          order_id: feedbackModal.order?.order_id,
          overall_rating: feedbackForm.overall_rating,
          build_quality_rating: feedbackForm.build_quality_rating,
          communication_rating: feedbackForm.communication_rating,
          accuracy_rating: feedbackForm.accuracy_rating,
          comment: feedbackForm.comment.trim(),
          images: feedbackForm.images,
        })
        setToastMessage('Thank you! Your customization feedback was submitted successfully.')
      }
      setFeedbackModal(null)
      fetchMyOrders()
    } catch (err) {
      console.error('Failed to submit custom feedback:', err)
      setToastMessage(err.message || 'Failed to submit feedback.')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const openCancelProjectModal = async (project) => {
    setCancelProjectTarget(project)
    setCancelProjectConfirmed(false)

    // Check if payment already exists in cached orders
    const cachedOrder = myOrders?.find(o => o.order_id === project?.order_id)
    const cachedPayment = cachedOrder?.payment || null
    setCancelProjectPayment(cachedPayment)
    setCancelProjectPaymentLoading(!cachedPayment && Boolean(project?.order_id))

    setCancelBuildPreview(null)
    setCancelClaimMethod('pickup')
    setCancelClaimRecipientName('')
    setCancelClaimRecipientContact('')
    setCancelClaimDeliveryInstructions('')
    setIsCancelProjectModalOpen(true)

    if (project?.order_id) {
      try {
        const orderRes = await adminApi.getOrder(project.order_id)
        const payment = orderRes?.data?.payment || orderRes?.data?.order?.payment || null
        if (payment) {
          setCancelProjectPayment(payment)
        }
      } catch (err) {
        console.error('Failed to load payment info for cancel modal:', err)
      } finally {
        setCancelProjectPaymentLoading(false)
      }
    }

    // Fetch build state preview if project has started
    if (project?.project_id && project?.status !== 'not_started') {
      setCancelBuildPreviewLoading(true)
      try {
        const res = await adminApi.getBuildStatePreview(project.project_id)
        setCancelBuildPreview(res?.data || null)
      } catch (err) {
        console.error('Failed to load build state preview:', err)
      } finally {
        setCancelBuildPreviewLoading(false)
      }
    }
  }

  const closeCancelProjectModal = (force = false) => {
    if (isCancellingProject && !force) return
    setIsCancelProjectModalOpen(false)
    setCancelProjectTarget(null)
    setCancelProjectPayment(null)
    setCancelProjectPaymentLoading(false)
    setCancelProjectConfirmed(false)
    setCancelBuildPreview(null)
    setCancelBuildPreviewLoading(false)
    setCancelClaimMethod('pickup')
    setCancelClaimRecipientName('')
    setCancelClaimRecipientContact('')
    setCancelClaimDeliveryInstructions('')
  }

  const handleCancelProject = async () => {
    if (!cancelProjectTarget?.project_id) return

    try {
      setIsCancellingProject(true)
      await adminApi.cancelMyProject(cancelProjectTarget.project_id)

      // If build has progress, submit claim method selection
      const hasBuildProgress = cancelBuildPreview?.has_progress
      if (hasBuildProgress) {
        try {
          const claimPayload = { method: cancelClaimMethod }
          if (cancelClaimMethod === 'courier') {
            if (cancelClaimRecipientName) claimPayload.recipient_name = cancelClaimRecipientName
            if (cancelClaimRecipientContact) claimPayload.recipient_contact = cancelClaimRecipientContact
            if (cancelClaimDeliveryInstructions) claimPayload.delivery_instructions = cancelClaimDeliveryInstructions
          }
          await adminApi.selectBuildClaimMethod(cancelProjectTarget.project_id, claimPayload)
        } catch (claimErr) {
          console.warn('Failed to submit claim method (claim was still created):', claimErr.message)
        }
      }

      setToastMessage(hasBuildProgress
        ? 'Project cancelled. A build claim has been created for your guitar.'
        : 'Project has been cancelled.'
      )
      fetchMyProjects();
      fetchMyOrders();
      fetchMyCustomizations();
      if (activeProjectView?.project_id === cancelProjectTarget.project_id) {
        setActiveProjectView(null)
      }
      closeCancelProjectModal(true)
    } catch (err) {
      setToastMessage(`Failed to cancel project: ${err.message}`);
    } finally {
      setIsCancellingProject(false)
    }
  };

  // Hold Project handlers
  const openHoldProjectModal = (project) => {
    setHoldProjectTarget(project)
    setHoldOption('resume_later')
    setHoldReason('')
    setHoldCustomReason('')
    setIsHoldProjectModalOpen(true)
  }

  const closeHoldProjectModal = (force = false) => {
    if (isHoldingProject && !force) return
    setIsHoldProjectModalOpen(false)
    setHoldProjectTarget(null)
    setHoldOption('resume_later')
    setHoldReason('')
    setHoldCustomReason('')
  }

  const getResolvedHoldReason = () => {
    if (holdReason === 'Others') return holdCustomReason.trim()
    return holdReason
  }

  const handleHoldProject = async () => {
    if (!holdProjectTarget?.project_id) return

    const resolvedReason = getResolvedHoldReason()
    try {
      setIsHoldingProject(true)
      await adminApi.requestProjectHold(holdProjectTarget.project_id, {
        hold_option: holdOption,
        reason: resolvedReason || 'Customer requested hold',
      })
      setToastMessage('Project has been placed on hold. Manufacturing is paused.');
      fetchMyProjects();
      closeHoldProjectModal(true)
    } catch (err) {
      setToastMessage(`Failed to request hold: ${err.message}`);
    } finally {
      setIsHoldingProject(false)
    }
  }

  // Resume / Continue Build handlers
  const openResumeProjectModal = (project) => {
    setResumeProjectTarget(project)
    setIsResumeProjectModalOpen(true)
  }

  const closeResumeProjectModal = (force = false) => {
    if (isResumingProject && !force) return
    setIsResumeProjectModalOpen(false)
    setResumeProjectTarget(null)
  }

  const handleResumeProject = async () => {
    if (!resumeProjectTarget?.project_id) return

    try {
      setIsResumingProject(true)
      await adminApi.resumeProject(resumeProjectTarget.project_id)
      setToastMessage('Project has been resumed! Manufacturing can continue.');
      fetchMyProjects();
      closeResumeProjectModal(true)
    } catch (err) {
      setToastMessage(`Failed to resume project: ${err.message}`);
    } finally {
      setIsResumingProject(false)
    }
  }

  // Cancel with options handlers
  const openCancelWithOptionsModal = (project) => {
    setCancelWithOptionsTarget(project)
    const initialOpt = project?.cancel_option || 'ship_to_address'
    setCancelOption(initialOpt === 'ship_unfinished' ? 'ship_to_address' : (initialOpt === 'pickup_unfinished' ? 'pickup_at_shop' : initialOpt))
    setCancelWithOptionsReason(project?.cancel_reason || '')
    setCancelWithOptionsConfirmed(false)
    setIsAddingCancelAddress(false)
    setCancelAddressSuccessMsg('')

    const projectAddressId = project?.cancel_address_id || project?.shipping_address_id
    if (projectAddressId) {
      setSelectedCancelAddressId(projectAddressId)
    } else if (addresses && addresses.length > 0) {
      const def = addresses.find((a) => a.is_default) || addresses[0]
      setSelectedCancelAddressId(def?.address_id || null)
    } else {
      setSelectedCancelAddressId(null)
    }

    if (!addresses || addresses.length === 0) {
      fetchAddresses()
    }
    setIsCancelWithOptionsModalOpen(true)
  }

  const closeCancelWithOptionsModal = (force = false) => {
    if ((isCancellingWithOptions || isWithdrawingCancelRequest || isSavingCancelAddress) && !force) return
    setIsCancelWithOptionsModalOpen(false)
    setCancelWithOptionsTarget(null)
    setCancelOption('ship_to_address')
    setCancelWithOptionsReason('')
    setCancelWithOptionsConfirmed(false)
    setSelectedCancelAddressId(null)
    setIsAddingCancelAddress(false)
    setCancelAddressSuccessMsg('')
  }

  const handleSaveCancelAddress = async (payload) => {
    try {
      setIsSavingCancelAddress(true)
      await adminApi.addAddress({ ...payload, isDefault: false })
      const res = await adminApi.getProfile()
      const updatedAddrs = res?.data?.user?.addresses || []
      setAddresses(updatedAddrs)
      const newlyAdded = updatedAddrs[updatedAddrs.length - 1] || updatedAddrs.find((a) => a.street_line1 === payload.streetLine1) || updatedAddrs[0]
      if (newlyAdded?.address_id) {
        setSelectedCancelAddressId(newlyAdded.address_id)
      }
      setCancelAddressSuccessMsg('New Address Saved ✓')
      setIsAddingCancelAddress(false)
      setTimeout(() => setCancelAddressSuccessMsg(''), 4000)
    } catch (err) {
      alert('Failed to save address: ' + err.message)
    } finally {
      setIsSavingCancelAddress(false)
    }
  }

  const handleCancelWithOptions = async () => {
    if (!cancelWithOptionsTarget?.project_id || !cancelWithOptionsReason.trim() || !cancelWithOptionsConfirmed) return

    const isShipping = cancelOption === 'ship_to_address' || cancelOption === 'ship_unfinished'
    if (isShipping && !selectedCancelAddressId) {
      setToastMessage('Please select a delivery address.')
      return
    }

    try {
      setIsCancellingWithOptions(true)
      await adminApi.requestProjectCancel(cancelWithOptionsTarget.project_id, {
        cancel_option: isShipping ? 'ship_to_address' : 'pickup_at_shop',
        cancel_reason: cancelWithOptionsReason,
        address_id: isShipping ? selectedCancelAddressId : null,
      })
      setToastMessage('Cancellation request submitted. Admin will review it shortly.')
      fetchMyProjects()
      closeCancelWithOptionsModal(true)
    } catch (err) {
      setToastMessage(`Failed to request cancellation: ${err.message}`)
    } finally {
      setIsCancellingWithOptions(false)
    }
  }

  const handleWithdrawCancelRequest = async () => {
    if (!cancelWithOptionsTarget?.project_id) return

    try {
      setIsWithdrawingCancelRequest(true)
      await adminApi.cancelProjectCancelRequest(cancelWithOptionsTarget.project_id)
      setToastMessage('Cancellation request withdrawn.')
      fetchMyProjects()
      closeCancelWithOptionsModal(true)
    } catch (err) {
      setToastMessage(`Failed to withdraw cancellation request: ${err.message}`)
    } finally {
      setIsWithdrawingCancelRequest(false)
    }
  }

  const handleRescheduleSubmit = async (aptId) => {
    if (!rescheduleDate || !rescheduleTime) {
      setToastMessage('Please select both date and time to reschedule.');
      return;
    }
    try {
      // type="time" provides HH:MM (24-hour)
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      await adminApi.updateAppointment(aptId, { scheduled_at: scheduledAt.toISOString(), time: rescheduleTime, status: 'approved' });
      setToastMessage('Appointment successfully rescheduled!');
      setReschedulingAptId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      fetchMyAppointments();
    } catch (err) {
      alert("Failed to reschedule: " + err.message);
    }
  };

  const openCancelAppointmentModal = (apt) => {
    setCancelAppointmentTarget(apt)
    setCancelAppointmentReason('')
    setIsCancelAppointmentModalOpen(true)
  }

  const handleCancelClick = (apt) => {
    const isDigital = isDigitalPayment(apt.payment_method)
    const confirmed = isPaymentConfirmed(apt.payment_status)
    if (isDigital && confirmed) {
      setCancelAppointmentTarget(apt)
      setIsPaymentConfirmedModalOpen(true)
    } else if (isDigital && !confirmed) {
      setCancelAppointmentTarget(apt)
      setRefundReason('')
      setIsRequestRefundModalOpen(true)
    } else {
      openCancelAppointmentModal(apt)
    }
  }

  const handleRequestRefund = async () => {
    if (!cancelAppointmentTarget?.appointment_id) return
    try {
      setIsRequestingRefund(true)
      await adminApi.createRefundRequest({
        appointment_id: cancelAppointmentTarget.appointment_id,
        payment_reference: cancelAppointmentTarget.payment_reference || cancelAppointmentTarget.payment_proof_url || '',
        amount: cancelAppointmentTarget.amount || null,
        reason: refundReason.trim(),
      })
      setToastMessage('Refund request submitted successfully. You may now cancel your appointment.')
      setIsRequestRefundModalOpen(false)
      setRefundReason('')
      openCancelAppointmentModal(cancelAppointmentTarget)
    } catch (err) {
      setToastMessage(`Failed to submit refund request: ${err.message}`)
    } finally {
      setIsRequestingRefund(false)
    }
  }

  const handleContinueWithoutRefund = () => {
    setIsRequestRefundModalOpen(false)
    openCancelAppointmentModal(cancelAppointmentTarget)
  }

  const handleKeepAppointment = () => {
    setIsPaymentConfirmedModalOpen(false)
    setIsRequestRefundModalOpen(false)
    setCancelAppointmentTarget(null)
  }

  const closeCancelAppointmentModal = (force = false) => {
    if (isCancellingAppointment && !force) return
    setIsCancelAppointmentModalOpen(false)
    setCancelAppointmentTarget(null)
    setCancelAppointmentReason('')
  }

  const handleCancelAppointment = async () => {
    if (!cancelAppointmentTarget?.appointment_id || !cancelAppointmentReason.trim()) {
      return
    }
    try {
      setIsCancellingAppointment(true)
      const reason = `Cancelled by customer: ${cancelAppointmentReason.trim()}`
      await adminApi.cancelMyAppointment(cancelAppointmentTarget.appointment_id, reason)
      setToastMessage('Appointment has been cancelled.')
      fetchMyAppointments()
      closeCancelAppointmentModal(true)
    } catch (err) {
      setToastMessage(`Failed to cancel appointment: ${err.message}`)
    } finally {
      setIsCancellingAppointment(false)
    }
  }

  const confirmDelete = async () => {
    if (!buildToDelete) return;

    let deletedCustomizationId = null

    for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
      const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      const deletedBuild = builds.find(b => b.id === buildToDelete)
      const filtered = builds.filter(b => b.id !== buildToDelete);
      if (builds.length !== filtered.length) {
        window.localStorage.setItem(storageKey, JSON.stringify(filtered));
        deletedCustomizationId = deletedBuild?.dbCustomizationId || deletedBuild?.customization_id || null
        if (window.localStorage.getItem('cosmoscraft_target_build_id') === buildToDelete) {
          window.localStorage.removeItem('cosmoscraft_target_build_id');
        }
        break;
      }
    }

    if (deletedCustomizationId) {
      try {
        await adminApi.deleteMyCustomization(deletedCustomizationId)
      } catch (error) {
        console.error('Failed to delete customization in database:', error)
      }
    }

    setRefreshCounter(prev => prev + 1);
    fetchMyCustomizations()
    setToastMessage('Build deleted successfully');
    setBuildToDelete(null);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  useEffect(() => {
    if (location.state?.message) {
      navigate(location.pathname, { replace: true, state: { ...location.state, message: undefined } })
    }
  }, [location, navigate])

  const updateAdditionalPartQuantity = (buildId, partIndex, newQuantity) => {
    if (viewingBuild && getBuildLockState(viewingBuild).isLocked) {
      handleLockedBuildAction()
      return
    }

    const updatedBuild = { ...viewingBuild };
    const partsArray = [...updatedBuild.additionalParts];

    if (newQuantity <= 0) {
      partsArray.splice(partIndex, 1);
    } else {
      partsArray[partIndex] = { ...partsArray[partIndex], quantity: newQuantity };
    }
    updatedBuild.additionalParts = partsArray;

    setViewingBuild(updatedBuild);

    for (const key of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
      const builds = JSON.parse(window.localStorage.getItem(key) || '[]');
      const bIndex = builds.findIndex(b => b.id === buildId);
      if (bIndex !== -1) {
        builds[bIndex] = updatedBuild;
        window.localStorage.setItem(key, JSON.stringify(builds));
        setRefreshCounter(prev => prev + 1);
        break;
      }
    }
  }

  const [profileData, setProfileData] = useState({
    username: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'male',
  })

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('')
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [isPasswordConfirmOpen, setIsPasswordConfirmOpen] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [addressData, setAddressData] = useState({
    label: 'Home',
    country: 'PH',
    streetLine1: '',
    streetLine2: '',
    province: '',
    city: '',
    barangay: '',
    stateProvince: '',
    postalZipCode: '',
    isDefault: true
  })
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [isSavingAddress, setIsSavingAddress] = useState(false)

  const [locationData, setLocationData] = useState({
    provinces: [],
    cities: [],
    barangays: []
  })

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, addressId: null, isBusy: false })
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  // Fetch profile data from API
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true)
      try {
        const res = await adminApi.getProfile()
        if (res?.data?.user) {
          const u = res.data.user
          setProfileData({
            username: u.email?.split('@')[0] || '',
            firstName: u.name?.firstName || '',
            middleName: u.name?.middleName || '',
            lastName: u.name?.lastName || '',
            email: u.email || '',
            phone: u.phone || '',
            gender: 'male',
          })
          const resolvedAvatar = u.avatar || u.avatarUrl || u.avatar_url || ''
          if (resolvedAvatar) setProfileImage(resolvedAvatar)
          updateUser({
            provider: u.provider,
            identityProviders: u.identityProviders || [],
            hasLocalPassword: u.hasLocalPassword,
          })
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Fetch addresses from API
  useEffect(() => {
    const fetchAddresses = async () => {
      setAddressesLoading(true)
      try {
        const res = await adminApi.getProfile()
        if (res?.data?.user?.addresses) {
          setAddresses(res.data.user.addresses)
        }
      } catch (err) {
        console.error('Failed to load addresses:', err)
      } finally {
        setAddressesLoading(false)
      }
    }
    fetchAddresses()
  }, [])

  useEffect(() => {
    try {
      const provinces = getAllProvinces()
      setLocationData(prev => ({ ...prev, provinces }))
    } catch (err) {
      console.error('Failed to load provinces:', err)
    }
  }, [])

  const handleProvinceChange = (provinceCode, provinceName) => {
    setAddressData(prev => ({ ...prev, province: provinceCode, city: '', barangay: '' }))
    setLocationData(prev => ({ ...prev, cities: [], barangays: [] }))
    if (provinceCode) {
      try {
        const cities = getMunicipalitiesByProvince(provinceCode)
        setLocationData(prev => ({ ...prev, cities }))
      } catch (err) {
        console.error('Failed to load cities:', err)
      }
    }
  }

  const handleCityChange = (cityCode, cityName) => {
    setAddressData(prev => ({ ...prev, city: cityCode, barangay: '' }))
    setLocationData(prev => ({ ...prev, barangays: [] }))
    if (cityCode) {
      try {
        const barangays = getBarangaysByMunicipality(cityCode)
        setLocationData(prev => ({ ...prev, barangays }))
      } catch (err) {
        console.error('Failed to load barangays:', err)
      }
    }
  }

  const handleBarangayChange = (barangayCode) => {
    setAddressData(prev => ({ ...prev, barangay: barangayCode }))
  }

  const handleImageChange = e => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => {
        setProfileImage(ev.target?.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handleConfirmLogout = () => {
    setIsLogoutConfirmOpen(false)
    logout()
    navigate('/')
  }

  const accountProvider = String(user?.provider || '').toLowerCase()
  const hasLocalPassword = Boolean(user?.hasLocalPassword)
  const isSocialProvider = accountProvider === 'google' || accountProvider === 'facebook'
  const isSocialOnlyAccount = isSocialProvider && !hasLocalPassword

  const menuItems = [
    { id: 'profile', label: 'Profile', icon: User, group: 'account' },
    { id: 'addresses', label: 'Addresses', icon: MapPin, group: 'account' },
    { id: 'password', label: 'Change Password', icon: Lock, group: 'account' },
    { id: 'my-guitar', label: 'My Guitar', icon: Guitar, group: 'orders' },
    { id: 'appointments', label: 'Appointments', icon: Calendar, group: 'orders' },
    { id: 'cart', label: 'My Cart', icon: ShoppingBag, group: 'orders' },
    { id: 'purchases', label: 'My Purchase', icon: Package, group: 'orders' },
  ]
  const renderPurchasesContent = () => {
    const filteredOrders = myOrders.filter(order => {
      if (activePurchaseTab === 'All') return true;
      if (activePurchaseTab === 'To Pay' && order.payment_status === 'pending') return true;
      if (activePurchaseTab === 'To Ship' && order.status === 'processing') return true;
      if (activePurchaseTab === 'To Receive' && ['shipped', 'out_for_delivery'].includes(order.status)) return true;
      if (activePurchaseTab === 'Completed' && ['delivered', 'received', 'completed'].includes(order.status)) return true;
      if (activePurchaseTab === 'Cancelled' && order.status === 'cancelled') return true;
      if (activePurchaseTab === 'Refund') {
        return Boolean(order.has_refund_request || order.refund_request_status || order.payment_status === 'refunded')
      }
      return false;
    });

    const isFulfilled = (status) => ['received', 'delivered', 'completed'].includes(status)

    return (
      <div className="space-y-8">
        {/* {renderProjectsContent()} */}

        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-1">Orders & Purchases</h2>
            <p className="text-sm text-[var(--text-muted)]">Track and manage your orders, refunds, and feedback</p>
          </div>

          {/* Order Status Filters */}
          <div className="flex flex-wrap gap-4 text-sm font-medium border-b border-[var(--border)] pb-3 mb-10 overflow-x-auto">
            {['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Refund'].map(label => (
              <button
                key={label}
                onClick={() => setActivePurchaseTab(label)}
                className={`pb-2 transition-colors duration-200 whitespace-nowrap ${label === activePurchaseTab
                  ? 'border-b-2 border-[var(--gold-primary)] text-[var(--gold-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-white border-b-2'
                  }`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {myOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
                <Package className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-white font-medium mb-1">No orders yet</p>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                Start shopping to see your orders here
              </p>
              <button
                type="button"
                onClick={() => navigate('/shop')}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition"
              >
                Browse Shop
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              {activePurchaseTab === 'Refund' ? (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-4">
                    <RefreshCw className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-white font-medium mb-1">No refund requests found</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    You do not have any orders with active refund requests or refunds.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-white font-medium mb-1">No orders found</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    You don't have any orders with this status.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {filteredOrders.map(order => {
                const subtotalAmount = Number(order.subtotal || 0)
                const shippingAmount = Number(order.shipping_cost || 0)
                const taxAmount = Number(order.tax_amount || 0)
                const totalAmount = Number(order.total_amount || 0)
                const displayTotalAmount = totalAmount > 0
                  ? Math.max(totalAmount - taxAmount, 0)
                  : subtotalAmount + shippingAmount
                const orderItems = Array.isArray(order.items) ? order.items : []
                const orderIsFulfilled = isFulfilled(order.status)
                const hasCustomItems = orderItems.some(i => i.customization_id)

                return (
                  <div key={order.order_id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                    <div className="flex flex-col gap-4 mb-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-white text-lg">{order.order_number}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Order Status</span>
                          <span className="inline-block px-3 py-1 bg-[var(--surface-light)] border border-[var(--border)] rounded-full text-xs font-semibold text-white capitalize">
                            {formatStatus(order.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Payment Status</span>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize border ${['approved', 'paid', 'verified'].includes(String(order.payment_status || '').toLowerCase())
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                            }`}>
                            {formatStatus(order.payment_status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {orderItems.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-3">Item Details</p>
                        <div className="space-y-2">
                          {orderItems.map((item, index) => {
                            const customization = item.customization_id ? customizationLookup.get(item.customization_id) : null
                            const itemName = item.product_name || customization?.name || item.product_sku || 'Custom Item'
                            const quantity = Number(item.quantity || 1)
                            const unitPrice = Number(item.unit_price || 0)
                            const hasReview = Boolean(item.review)
                            const canReview = orderIsFulfilled && !item.customization_id && order.payment_status !== 'refunded'

                            return (
                              <div key={item.order_item_id || `${order.order_id}-${index}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{itemName}</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">
                                      Qty: {quantity}{item.customization_id ? ' • Custom Build' : ''}
                                    </p>
                                  </div>
                                  <span className="text-sm font-semibold text-white whitespace-nowrap">PHP {unitPrice.toLocaleString('en-PH')}</span>
                                </div>
                                {/* Inline review badge for product items */}
                                {!item.customization_id && hasReview && (
                                  <div className="mt-2.5 pt-2.5 border-t border-[var(--border)]/50 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                      <span className="text-xs font-medium text-green-400">Reviewed</span>
                                      <div className="flex items-center gap-0.5 ml-1">
                                        {Array.from({ length: 5 }).map((_, si) => (
                                          <Star key={si} className={`w-3 h-3 ${si < (item.review.rating || 0) ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]' : 'text-zinc-600 fill-zinc-800'}`} />
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewModal({ mode: 'view', order, item, review: item.review })
                                        }}
                                        className="text-xs text-[var(--gold-primary)] hover:underline font-medium"
                                      >
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewForm({
                                            rating: item.review.rating || 5,
                                            title: item.review.title || '',
                                            comment: item.review.comment || '',
                                            images: Array.isArray(item.review.images) ? item.review.images : [],
                                          })
                                          setReviewModal({ mode: 'edit', order, item, review: item.review })
                                        }}
                                        className="text-xs text-white/70 hover:text-white hover:underline font-medium"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {/* Rate product button for unreviewed fulfilled product items */}
                                {canReview && !hasReview && (
                                  <div className="mt-2.5 pt-2.5 border-t border-[var(--border)]/50 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewForm({ rating: 5, title: '', comment: '', images: [] })
                                        setReviewModal({ mode: 'rate', order, item, review: null })
                                      }}
                                      className="text-xs px-3 py-1.5 border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-colors rounded-lg font-semibold flex items-center gap-1.5"
                                    >
                                      <Star className="w-3 h-3" />
                                      Rate Product
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Customization Feedback Section (per-order, not per-item) */}
                    {hasCustomItems && orderIsFulfilled && order.payment_status !== 'refunded' && (
                      <div className="mt-3">
                        {order.customization_feedback ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-xs font-medium text-green-400">Customization Feedback Submitted</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFeedbackModal({ mode: 'view', order, feedback: order.customization_feedback })
                                  }}
                                  className="text-xs text-[var(--gold-primary)] hover:underline font-medium"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fb = order.customization_feedback
                                    setFeedbackForm({
                                      overall_rating: fb.overall_rating || 5,
                                      build_quality_rating: fb.build_quality_rating || 5,
                                      communication_rating: fb.communication_rating || 5,
                                      accuracy_rating: fb.accuracy_rating || 5,
                                      comment: fb.comment || '',
                                      images: Array.isArray(fb.images) ? fb.images : [],
                                    })
                                    setFeedbackModal({ mode: 'edit', order, feedback: fb })
                                  }}
                                  className="text-xs text-white/70 hover:text-white hover:underline font-medium"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                              {[
                                { label: 'Overall', key: 'overall_rating' },
                                { label: 'Quality', key: 'build_quality_rating' },
                                { label: 'Communication', key: 'communication_rating' },
                                { label: 'Accuracy', key: 'accuracy_rating' },
                              ].map(dim => (
                                <div key={dim.key} className="text-center">
                                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{dim.label}</p>
                                  <div className="flex items-center justify-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, si) => (
                                      <Star key={si} className={`w-2.5 h-2.5 ${si < (order.customization_feedback[dim.key] || 0) ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]' : 'text-zinc-600 fill-zinc-800'}`} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setFeedbackForm({ overall_rating: 5, build_quality_rating: 5, communication_rating: 5, accuracy_rating: 5, comment: '', images: [] })
                                setFeedbackModal({ mode: 'leave', order, feedback: null })
                              }}
                              className="text-xs px-3 py-1.5 border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-colors rounded-lg font-semibold flex items-center gap-1.5"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Leave Customization Feedback
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-end mt-4">
                      <div className="text-sm text-[var(--text-muted)] [&>span:last-child]:hidden">
                        <span className="block">Items: {orderItems.length}</span>
                        <span className="block">Shipping: ₱{Number(order.shipping_cost || 0).toLocaleString('en-PH')}</span>
                        <span className="block mt-1">Tax: ₱{Number(order.tax_amount || 0).toLocaleString('en-PH')}</span>
                      </div>
                      <div className="text-right items-end flex flex-col [&>span:not(:first-child)]:hidden">
                        <span className="text-sm text-[var(--text-muted)] mb-1">Total Amount</span>
                        <div className="text-xl font-bold text-[var(--gold-primary)] block">PHP {displayTotalAmount.toLocaleString('en-PH')}</div>
                        <span className="text-xl font-bold text-[var(--gold-primary)] block">₱{displayTotalAmount.toLocaleString('en-PH')}</span>
                        <span className="text-xl font-bold text-[var(--gold-primary)] block">₱{Number(order.total_amount || 0).toLocaleString('en-PH')}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end flex-wrap gap-3">
                      <button
                        onClick={() => printCustomerInvoice(order)}
                        disabled={printingOrderId === order.order_id}
                        className="px-4 py-2 border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                      >
                        {printingOrderId === order.order_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Print Invoice
                      </button>
                      {order.status === 'pending' && (
                        <button
                          onClick={() => openCancelOrderModal(order)}
                          className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors rounded-lg text-sm font-semibold"
                        >
                          Cancel Order
                        </button>
                      )}
                      {['shipped', 'out_for_delivery', 'delivered'].includes(order.status) && order.status !== 'received' && (
                        <button
                          onClick={() => handleMarkAsReceived(order)}
                          disabled={isMarkingReceived}
                          className="px-4 py-2 border border-green-500/30 text-green-500 hover:bg-green-500/10 transition-colors rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                        >
                          {isMarkingReceived ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Received
                        </button>
                      )}
                      {(order.status === 'received' || order.status === 'delivered') && order.payment_status !== 'refunded' && !order.has_refund_request && (
                        <button
                          onClick={() => openRefundModal(order)}
                          className="px-4 py-2 border border-[var(--border)] text-white hover:bg-white/5 transition-colors rounded-lg text-sm font-semibold flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4 text-[var(--gold-primary)]" />
                          Refund
                        </button>
                      )}
                      {orderIsFulfilled && (
                        <button
                          onClick={() => handleBuyAgain(order.order_id)}
                          className="px-4 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all rounded-lg text-sm font-bold flex items-center gap-2"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Buy Again
                        </button>
                      )}
                    </div>
                    {(order.status === 'received' || order.status === 'delivered') && order.has_refund_request && (
                      <div className="mt-3 flex justify-end items-center gap-3 flex-wrap">
                        {(() => {
                          const refundConfig = getRefundStatusConfig(order.refund_request_status)
                          const RefundIcon = refundConfig.icon
                          return (
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${refundConfig.className}`}>
                              <RefundIcon className="w-4 h-4" />
                              {refundConfig.label}
                            </span>
                          )
                        })()}
                        {['pending', 'pending_payment_verification'].includes(order.refund_request_status) && (
                          <button
                            onClick={async () => {
                              try {
                                await adminApi.withdrawRefund(order.refund_request_id)
                                setToastMessage('Refund request withdrawn.')
                                fetchMyOrders()
                              } catch (err) {
                                setToastMessage(`Failed to withdraw refund: ${err.message}`)
                              }
                            }}
                            className="px-4 py-2 border border-slate-500/30 text-slate-400 hover:bg-slate-500/10 transition-colors rounded-lg text-sm font-semibold"
                          >
                            Withdraw Refund
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  function formatAppointmentServiceType(type) {
    if (!type) return '—'
    if (type === 'service_home') return 'Home Service'
    if (type === 'service_in_shop') return 'In-store Service'
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  function getSelectedGuitarLabel(apt) {
    const details = apt.guitar_details
    if (!details) return null
    const brand = details.brand || ''
    const model = details.model || ''
    const type = details.type || ''
    if (brand || model) {
      const parts = [brand, model].filter(Boolean)
      return type ? `${parts.join(' ')} (${type.charAt(0).toUpperCase() + type.slice(1)})` : parts.join(' ')
    }
    return null
  }

  function getAddressLabel(apt) {
    return apt.customer_address || apt.address || ''
  }

  function getContactNumber(apt) {
    return apt.customer_phone || apt.user_phone || apt.phone || ''
  }

  const renderAppointmentsContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">My Appointments</h2>
          <p className="text-sm text-[var(--text-muted)]">View and manage your service appointments</p>
        </div>
        <button
          onClick={() => navigate('/appointments')}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Book Appointment
        </button>
      </div>

      {myAppointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
            <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <p className="text-white font-medium mb-1">No appointments yet</p>
          <p className="text-sm text-[var(--text-muted)] mb-6">Book a service appointment to see it here</p>
        </div>
      ) : (
        <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-2">
          <div className="flex items-center justify-end mb-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span>Sort by:</span>
              <select
                value={appointmentSort}
                onChange={(e) => setAppointmentSort(e.target.value)}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
              >
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
              </select>
            </label>
          </div>
          {[...myAppointments].sort((a, b) => {
            const dateA = new Date(a.scheduled_at || a.date || a.created_at || 0)
            const dateB = new Date(b.scheduled_at || b.date || b.created_at || 0)
            return appointmentSort === 'soonest' ? dateA - dateB : dateB - dateA
          }).map(apt => {
            const apptDate = apt.scheduled_at || apt.date;

            // Check if past current time and not completed/cancelled
            const isPast = apptDate && new Date(apptDate) < new Date();
            const needsReschedule = isPast && apt.status !== 'completed' && apt.status !== 'cancelled';
            const isReschedulingThis = reschedulingAptId === (apt.appointment_id || apt.id);

            const selectedGuitar = getSelectedGuitarLabel(apt);
            const contactNumber = getContactNumber(apt);
            const addressLabel = getAddressLabel(apt);
            const appointmentNotes = apt.notes || '';
            const isCancelledApt = apt.status === 'cancelled';
            let cancellationReason = '';
            let displayNotes = appointmentNotes;

            if (isCancelledApt) {
              // Handle both customer cancellations ("Cancelled: ...") and
              // admin/shop cancellations ("Status changed: ...")
              const cancelMatch = appointmentNotes.match(/^\s*(?:Cancelled|Status changed):\s*(.*)$/im);
              if (cancelMatch) {
                cancellationReason = cancelMatch[1].trim();
                // Strip "Cancelled by customer:" prefix so only the reason is shown
                cancellationReason = cancellationReason.replace(/^Cancelled by customer:\s*/i, '').trim();
                displayNotes = appointmentNotes.replace(/^\s*(?:Cancelled|Status changed):[^\n]*\n?/im, '').trim();
              }
            }

            return (
              <div key={apt.appointment_id || apt.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">Appointment</h3>
                    {apt.reference_code && (
                      <p className="text-xs font-mono text-[#d4af37] mt-0.5">{apt.reference_code}</p>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1 capitalize">
                      {apt.service_name || (Array.isArray(apt.services) ? apt.services.map(s => s.replace(/-/g, ' ')).join(', ') : 'Consultation')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border ${apt.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    apt.status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                      apt.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                    }`}>
                    {apt.status || 'Pending'}
                  </span>
                </div>

                {isReschedulingThis ? (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] bg-[var(--surface-dark)] p-4 rounded-xl">
                    <p className="text-white font-semibold mb-3">Select New Schedule</p>
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">New Date</label>
                        <input type="date" min={new Date().toISOString().split('T')[0]} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">New Time</label>
                        <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-sm" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setReschedulingAptId(null)} className="px-4 py-2 rounded-lg text-[var(--text-muted)] text-sm font-semibold hover:text-white transition">Cancel</button>
                      <button onClick={() => handleRescheduleSubmit(apt.appointment_id || apt.id)} className="px-4 py-2 rounded-lg bg-[var(--gold-primary)] text-black text-sm font-semibold hover:bg-[var(--gold-secondary)] transition">Confirm Reschedule</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mt-4 pt-4 border-t border-[var(--border)]">
                    <div>
                      <span className="block text-[var(--text-muted)] mb-0.5">Date & Time</span>
                      <span className="text-white">
                        {apptDate ? new Date(apptDate).toLocaleDateString() : '—'} at {apt.time || (apptDate ? new Date(apptDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[var(--text-muted)] mb-0.5">Branch</span>
                      <span className="text-white capitalize">{apt.location_id ? apt.location_id.replace(/-/g, ' ') : '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[var(--text-muted)] mb-0.5">Service Type</span>
                      <span className="text-white">{formatAppointmentServiceType(apt.appointment_type)}</span>
                    </div>
                    <div>
                      <span className="block text-[var(--text-muted)] mb-0.5">Selected Guitar</span>
                      <span className="text-white">{selectedGuitar || '—'}</span>
                    </div>
                    {displayNotes && (
                      <div className="sm:col-span-2 mt-1">
                        <span className="block text-[var(--text-muted)] mb-0.5">Notes</span>
                        <div className="space-y-2">
                          {(() => {
                            const lines = displayNotes.split('\n')
                            const textParts = []
                            const imageParts = []

                            lines.forEach(line => {
                              const imageMatch = line.match(/(https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp|\.bmp)[^\s]*)/i)
                              if (imageMatch) {
                                const before = line.replace(imageMatch[0], '').trim()
                                // Skip image reference labels like "Guitar reference image:" / "Service reference image:"
                                const isImageLabel = /^(?:guitar|service)\s+reference\s+image:?\s*$/i.test(before)
                                if (before && !isImageLabel) textParts.push(before)
                                imageParts.push(imageMatch[1])
                              } else {
                                const trimmed = line.trim()
                                if (trimmed) textParts.push(trimmed)
                              }
                            })

                            return (
                              <>
                                {textParts.filter(Boolean).length > 0 && (
                                  <span className="text-white/80 text-xs leading-relaxed block bg-[var(--surface-dark)] rounded-lg p-3 border border-[var(--border)]">
                                    {textParts.filter(Boolean).join('\n')}
                                  </span>
                                )}
                                {imageParts.map((url, i) => (
                                  <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-2">
                                    <img
                                      src={url}
                                      alt={`Reference image ${i + 1}`}
                                      className="h-40 w-full rounded-lg object-cover"
                                      onError={(e) => { e.target.style.display = 'none' }}
                                    />
                                  </div>
                                ))}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )}

                    {isCancelledApt && cancellationReason && (
                      <div className="sm:col-span-2 mt-3 pt-4 border-t border-[var(--border)]">
                        <span className="block text-[var(--text-muted)] mb-0.5">Cancellation Reason</span>
                        <span className="text-red-400 text-xs leading-relaxed">{cancellationReason}</span>
                      </div>
                    )}

                    {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                      <div className="sm:col-span-2 mt-3 pt-4 border-t border-[var(--border)] flex justify-end">
                        <button
                          onClick={() => handleCancelClick(apt)}
                          className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors rounded-lg text-sm font-semibold"
                        >
                          Cancel Appointment
                        </button>
                      </div>
                    )}

                    {needsReschedule && (
                      <div className="sm:col-span-2 mt-3 pt-4 border-t border-[var(--border)] flex items-center justify-between bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-orange-400" />
                          <div>
                            <p className="text-orange-400 font-semibold text-sm">Action Required</p>
                            <p className="text-orange-400/80 text-xs mt-0.5">This appointment is past due. Please reschedule it.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            navigate('/appointments', {
                              state: {
                                rescheduleAppointment: {
                                  appointment_id: apt.appointment_id || apt.id,
                                  appointment_type: apt.appointment_type,
                                  services: apt.services,
                                  location_id: apt.location_id,
                                  guitar_details: apt.guitar_details,
                                  notes: apt.notes,
                                  scheduled_at: apt.scheduled_at,
                                  status: apt.status,
                                }
                              }
                            });
                          }}
                          className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-xs hover:bg-orange-600 transition"
                        >
                          Reschedule
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  )

  const renderProjectsContent = () => {
    if (activeProjectView) {
      const cleanTrackerName = (activeProjectView.name || activeProjectView.title || 'Custom Build')
        .replace(/\s*\(((?:PO|CO|SO)-\d{8}-\d+)\)\s*/g, '')
        .replace(/\s*Order\s*#[^\s]*\s*/gi, '')
        .trim();
      return (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 lg:p-7 xl:p-8">
          <button onClick={() => setActiveProjectView(null)} className="mb-6 text-[var(--gold-primary)] hover:underline flex items-center gap-2 text-sm font-semibold">
            &larr; Back to Build Projects
          </button>
          <CustomerProjectTracker
            projectId={activeProjectView.project_id}
            projectName={cleanTrackerName}
            projectData={activeProjectView}
            customBuildId={activeProjectView.customBuildId}
          />
        </div>
      );
    }

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <div className="flex flex-wrap gap-6 sm:gap-8 border-b border-[var(--border)] mb-6">
          {[
            { id: 'build-projects', label: 'Build Projects' },
            { id: 'saved-builds', label: 'Saved Builds' },
          ].map((tab) => {
            const isActive = activeBuildTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveBuildTab(tab.id)}
                className={`relative pb-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors ${isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
                  }`}
              >
                {tab.label}
                <span
                  className={`absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity ${isActive ? 'opacity-100 bg-[var(--gold-primary)]' : 'opacity-0'
                    }`}
                />
              </button>
            )
          })}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Build Projects</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8">Track progress on your custom builds and repairs</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search projects..."
              value={myProjectSearch}
              onChange={(e) => setMyProjectSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            />
          </div>
          <select
            value={myProjectSort}
            onChange={(e) => setMyProjectSort(e.target.value)}
            className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          >
            <option value="updated">Recently Updated</option>
            <option value="created">Recently Created</option>
            <option value="name">Project Name</option>
            <option value="progress">Progress</option>
          </select>
        </div>

        {myProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
              <Briefcase className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-white font-medium mb-1">No active projects</p>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              When you order a custom build or repair, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {myProjects.map((project, index) => {
              const buildId = project.order_number || project.custom_build_id || project.customBuildId;

              // Clean project name - remove any ORD/order references from the stored title
              const cleanName = (project.name || project.title || 'Custom Build')
                .replace(/\s*\(((?:PO|CO|SO)-\d{8}-\d+)\)\s*/g, '')
                .replace(/\s*Order\s*#[^\s]*\s*/gi, '')
                .trim();

              return (
                <div key={project.project_id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-white">{cleanName}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Build ID: {buildId || '—'}
                      </p>
                      <p className="text-[var(--text-muted)] text-sm mt-2">
                        Estimated completion:{' '}
                        <span className="text-white font-medium">
                          {formatEstimatedCompletionDate(project) || 'Not set'}
                        </span>
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-4">
                        {String(project.status || '').toLowerCase() === 'cancelled' ? (
                          <span className={`px-2.5 py-1 border rounded-full text-xs font-bold ${project.refund_status === 'refunded' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' :
                            project.refund_status === 'processing' ? 'border-sky-500/40 bg-sky-500/10 text-sky-300' :
                              project.refund_status === 'approved' ? 'border-green-500/40 bg-green-500/10 text-green-300' :
                                project.refund_status === 'pending_payment_verification' ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' :
                                  project.cancel_resolution === 'partial_refund_and_build' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' :
                                    project.cancel_resolution === 'partial_refund_and_parts' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' :
                                      project.cancel_resolution === 'current_build_released' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                                        project.cancel_resolution === 'parts_returned' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                                          project.refund_status === 'pending' || project.cancel_resolution === 'full_refund' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' :
                                            'border-red-500/40 bg-red-500/10 text-red-300'
                            }`}>
                            {project.refund_status === 'refunded' ? `Cancelled — Refunded (${formatCurrency(project.refunded_amount || project.refund_approved_amount || project.refund_amount_requested)})` :
                              project.refund_status === 'processing' ? `Cancelled — Refund Processing (${formatCurrency(project.refund_approved_amount || project.refund_amount_requested)})` :
                                project.refund_status === 'approved' ? `Cancelled — Refund Approved (${formatCurrency(project.refund_approved_amount || project.refund_amount_requested)})` :
                                  project.refund_status === 'pending_payment_verification' ? 'Cancelled — Payment Verification Pending' :
                                    project.cancel_resolution === 'partial_refund_and_build' ? 'Cancelled — Partial Refund & Build Claim' :
                                      project.cancel_resolution === 'partial_refund_and_parts' ? 'Cancelled — Partial Refund & Parts Return' :
                                        project.cancel_resolution === 'current_build_released' ? 'Cancelled — Guitar Build Claim' :
                                          project.cancel_resolution === 'parts_returned' ? 'Cancelled — Acquired Parts Release' :
                                            project.refund_status === 'pending' ? 'Cancelled — Refund Under Review' :
                                              'Cancelled — Settlement Closed'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-[var(--border)] rounded-full text-xs font-semibold text-white">{formatStatus(project.status)}</span>
                        )}
                        <span className="text-[var(--gold-primary)] font-bold text-sm">{project.progress}% Complete</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    {String(project.status || '').toLowerCase() !== 'cancelled' && String(project.status || '').toLowerCase() !== 'completed' && (
                      <>
                        {String(project.status || '').toLowerCase() !== 'on_hold' ? (
                          <>
                            {String(project.status || '').toLowerCase() === 'not_started' && (
                              <button
                                onClick={() => openCancelProjectModal(project)}
                                className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors text-sm font-semibold"
                              >
                                Cancel Project
                              </button>
                            )}
                            {String(project.status || '').toLowerCase() !== 'not_started' && !project.cancel_requested_at && (
                              <button
                                onClick={() => openCancelWithOptionsModal(project)}
                                className="px-4 py-2 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors text-sm font-semibold"
                              >
                                Request Cancellation
                              </button>
                            )}
                            {String(project.status || '').toLowerCase() !== 'not_started' && project.cancel_requested_at && !project.cancel_approved_at && (
                              <button
                                onClick={() => openCancelWithOptionsModal(project)}
                                className="px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-semibold flex items-center gap-1.5"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                Cancellation Pending
                              </button>
                            )}
                            {String(project.status || '').toLowerCase() !== 'not_started' && (
                              <button
                                onClick={() => openHoldProjectModal(project)}
                                className="px-4 py-2 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors text-sm font-semibold"
                              >
                                Hold Build
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              On Hold
                            </span>
                            <button
                              onClick={() => openResumeProjectModal(project)}
                              className="px-4 py-2 rounded-lg border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 transition-colors text-sm font-semibold flex items-center gap-1.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Continue Build
                            </button>
                          </>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setActiveProjectView(project)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px rgba(212,175,55,0.5)] transition-all flex items-center gap-2"
                    >
                      <span className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/10">
                          <Activity className="w-4 h-4" />
                        </span>
                        <span className="flex flex-col items-start leading-tight">
                          <span className="text-[10px] uppercase tracking-wide text-[var(--text-dark)]/70">Project</span>
                          <span className="text-sm font-bold">Track Progress</span>
                        </span>
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}

            {myProjectsPagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-[var(--text-muted)] text-sm">
                  Showing {(myProjectPage - 1) * MY_PROJECTS_PAGE_SIZE + 1} to {Math.min(myProjectPage * MY_PROJECTS_PAGE_SIZE, myProjectsPagination.total || 0)} of {myProjectsPagination.total || 0} projects
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMyProjectPage(p => Math.max(1, p - 1))}
                    disabled={myProjectPage === 1}
                    className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <span className="text-white text-sm">
                    Page {myProjectPage} of {myProjectsPagination.total_pages}
                  </span>
                  <button
                    onClick={() => setMyProjectPage(p => Math.min(myProjectsPagination.total_pages, p + 1))}
                    disabled={myProjectPage === myProjectsPagination.total_pages}
                    className="p-2 hover:bg-[var(--surface-dark)] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>

        )}
      </div>
    );

  };

  const renderMyGuitarContent = () => {
    if (activeProjectView) {
      return renderProjectsContent()
    }

    const savedGuitarBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]').map(b => ({ ...b, isBass: false }))
    const savedBassBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').map(b => ({ ...b, isBass: true }))
    const allBuilds = [...savedGuitarBuilds, ...savedBassBuilds].sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
    const isBuildLimitReached = allBuilds.length >= MAX_SAVED_GUITAR_BUILDS

    const deleteBuild = (buildId) => {
      setBuildToDelete(buildId);
    };

    return (
      <div className="space-y-8">
        {activeBuildTab === 'build-projects' && renderProjectsContent()}

        {activeBuildTab === 'saved-builds' && (
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
            <div className="flex flex-wrap gap-6 sm:gap-8 border-b border-[var(--border)] mb-6">
              {[
                { id: 'build-projects', label: 'Build Projects' },
                { id: 'saved-builds', label: 'Saved Builds' },
              ].map((tab) => {
                const isActive = activeBuildTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveBuildTab(tab.id)}
                    className={`relative pb-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors ${isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
                      }`}
                  >
                    {tab.label}
                    <span
                      className={`absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity ${isActive ? 'opacity-100 bg-[var(--gold-primary)]' : 'opacity-0'
                        }`}
                    />
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">My Saved Builds</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Manage your custom guitar and bass designs ({allBuilds.length}/{MAX_SAVED_GUITAR_BUILDS})
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (isBuildLimitReached) {
                      setToastMessage('You can only save up to 10 guitar builds. Please delete an existing build before creating a new one.')
                      return
                    }
                    setShowSelectInstrumentModal(true)
                  }}
                  disabled={isBuildLimitReached}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${isBuildLimitReached
                    ? 'bg-[var(--surface-light)] text-[var(--text-muted)] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                    }`}
                >
                  <Guitar className="w-4 h-4" />
                  Create New
                </button>
              </div>
            </div>

            {isBuildLimitReached && (
              <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-amber-300 text-sm font-medium">
                  You can only save up to 10 guitar builds. Please delete an existing build before creating a new one.
                </p>
              </div>
            )}

            {allBuilds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
                  <Guitar className="w-8 h-8 text-[var(--text-muted)]" />
                </div>
                <p className="text-white font-medium mb-1">No saved builds yet</p>
                <p className="text-sm text-[var(--text-muted)] mb-6">Start customizing your dream instrument</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {allBuilds.map((build) => {
                  const additionalPartsTotal = (build.additionalParts || []).reduce((sum, p) => sum + (p.price * p.quantity), 0);
                  const grandTotal = build.price + additionalPartsTotal;
                  const buildLockState = getBuildLockState(build)

                  return (
                    <div key={build.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4 gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-white">{build.name || 'Custom Build'}</h3>
                            {buildLockState.isLocked && (
                              <span className="px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold">
                                Already Ordered
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-1">Saved on {new Date(build.savedAt || new Date()).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-[var(--gold-primary)] block">₱{grandTotal.toLocaleString('en-PH')}</span>
                          {additionalPartsTotal > 0 && <span className="text-xs text-[var(--text-muted)]">Includes Add-ons</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-sm flex-1">
                        {Object.entries(build.config || {}).map(([key, val]) => (
                          val && typeof val === 'string' ? (
                            <div key={key} className="flex items-center gap-1">
                              <span className="text-xs text-[var(--text-muted)] capitalize truncate max-w-[80px]">{key}:</span>
                              <span className="text-xs text-white truncate max-w-[100px]">{val}</span>
                            </div>
                          ) : null
                        )).slice(0, 6)}
                      </div>

                      {buildLockState.isLocked && (
                        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>This build is already in an active order, so parts, specs, and checkout are now locked.</span>
                        </div>
                      )}

                      <div className="mt-6 space-y-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={buildLockState.isLocked}
                            onClick={() => {
                              window.localStorage.setItem('cosmoscraft_target_build_id', build.id);
                              navigate('/shop');
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg border text-[var(--text-light)] text-xs transition-all text-center font-medium ${buildLockState.isLocked
                              ? 'border-[var(--border)] opacity-40 cursor-not-allowed'
                              : 'border-[var(--border)] hover:bg-white/5'
                              }`}
                          >
                            Add Parts
                          </button>
                          <button
                            onClick={() => setViewingBuild(build)}
                            className="flex-1 py-1.5 px-2 rounded-lg border border-[var(--border)] text-[var(--text-light)] text-xs hover:bg-white/5 transition-all text-center font-medium"
                          >
                            View Summary
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={buildLockState.isLocked}
                            onClick={() => navigate(build.isBass ? `/customize-bass?edit=${build.id}` : `/customize?edit=${build.id}`)}
                            className={`flex-1 py-1.5 px-2 rounded-lg border text-xs transition-all text-center font-medium ${buildLockState.isLocked
                              ? 'border-blue-500/20 text-blue-200/40 cursor-not-allowed'
                              : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                              }`}
                          >
                            Edit Build
                          </button>
                          <button
                            onClick={() => deleteBuild(build.id)}
                            className="flex-[0.5] py-1.5 px-2 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-all flex items-center justify-center font-medium"
                          >
                            Delete
                          </button>
                        </div>
                        {buildLockState.isLocked ? (
                          buildLockState.project ? (
                            <button
                              type="button"
                              onClick={() => setActiveProjectView(buildLockState.project)}
                              className="w-full mt-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-2"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Buy Now
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleLockedBuildAction}
                              className="w-full mt-2 py-2.5 px-3 rounded-lg border border-[var(--border)] text-[var(--text-muted)] font-bold text-sm transition-all flex items-center justify-center gap-2"
                            >
                              <Clock className="w-4 h-4" />
                              Awaiting Project Setup
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              navigate('/checkout', { state: { checkoutItem: build, isCustomBuild: true } });
                            }}
                            className="w-full mt-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-2"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Buy Now
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderCartContent = () => {
    const cartTotal = getTotalPrice()
    const cartCount = getCartCount()
    const selectedCartItemIds = getSelectedItemIds()
    const selectedCount = selectedCartItemIds.length
    const allItemsSelected = cart.length > 0 && cart.every(item => selectedCartItemIds.includes(String(item.id)))

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">My Cart</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in your cart` : 'Your cart is empty'}
            </p>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllItems}
              className="text-sm font-medium text-[var(--gold-primary)] hover:text-white transition-colors"
            >
              {allItemsSelected ? 'Clear Selection' : 'Select All'}
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
              <ShoppingBag className="w-10 h-10 text-[var(--text-muted)]" />
            </div>
            <p className="text-white font-medium mb-2">Your cart is empty</p>
            <p className="text-sm text-[var(--text-muted)] mb-6 text-center max-w-sm">
              Browse our shop and add some products to your cart to see them here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition"
            >
              Browse Shop
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {selectedCount} of {cart.length} item{cart.length !== 1 ? 's' : ''} selected for checkout
            </div>

            {cart.map((item) => (
              <SelectableCartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                isSelected={selectedCartItemIds.includes(String(item.id))}
                onToggleSelect={toggleItemSelection}
                selectionEnabled
                showQuantityControls
                showRemove
              />
            ))}

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg text-[var(--text-muted)]">Total:</span>
                <span className="text-2xl font-bold text-[var(--gold-primary)]">₱{cartTotal.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleSaveProfile = async () => {
    try {
      const avatarPayload = profileImage && profileImage.startsWith('data:')
        ? { avatarUrl: profileImage }
        : {}

      await adminApi.updateProfile({
        firstName: profileData.firstName,
        middleName: profileData.middleName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        ...avatarPayload,
      })

      // Refresh profile from backend so persisted avatar URL is reflected everywhere (header pill included).
      const latestProfile = await adminApi.getProfile()
      const latestUser = latestProfile?.data?.user
      if (latestUser) {
        const resolvedAvatar = latestUser.avatar || latestUser.avatarUrl || latestUser.avatar_url || ''
        if (resolvedAvatar) setProfileImage(resolvedAvatar)
        updateUser({
          ...latestUser,
          avatar: latestUser.avatar || latestUser.avatarUrl || latestUser.avatar_url || '',
        })
      }

      setToastMessage('Profile updated successfully!')
      setIsEditingProfile(false)
    } catch (err) {
      alert("Failed to update profile: " + err.message)
    }
  }

  const handleChangePassword = () => {
    setPasswordError('')
    setPasswordSuccessMessage('')

    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('New password and confirmation are required')
      return
    }

    if (!isSocialOnlyAccount && !passwordData.oldPassword) {
      setPasswordError('Current password is required')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    if (!/[A-Z]/.test(passwordData.newPassword) || !/[a-z]/.test(passwordData.newPassword) || !/[0-9]/.test(passwordData.newPassword) || !/[@$!%*?&]/.test(passwordData.newPassword)) {
      setPasswordError('Password must contain uppercase, lowercase, number, and special character')
      return
    }

    setIsPasswordConfirmOpen(true)
  }

  const handleConfirmPasswordChange = async () => {
    setIsPasswordConfirmOpen(false)
    setIsPasswordLoading(true)

    try {
      const payload = {
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      }

      if (!isSocialOnlyAccount) {
        payload.oldPassword = passwordData.oldPassword
      }

      const response = await adminApi.changePassword(payload)
      setPasswordSuccessMessage(response?.message || (isSocialOnlyAccount ? 'Password saved successfully.' : 'Password changed successfully.'))
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
      updateUser({ hasLocalPassword: true })
    } catch (err) {
      const errorMsg = err.message || 'Failed to process password change'
      if (errorMsg.toLowerCase().includes('incorrect')) {
        setPasswordError('Current password is incorrect')
      } else if (errorMsg.toLowerCase().includes('different')) {
        setPasswordError('New password must be different from current password')
      } else if (errorMsg.toLowerCase().includes('match')) {
        setPasswordError('Passwords do not match')
      } else if (errorMsg.toLowerCase().includes('8')) {
        setPasswordError('Password must be at least 8 characters with uppercase, lowercase, number, and special character')
      } else {
        setPasswordError(errorMsg)
      }
    } finally {
      setIsPasswordLoading(false)
    }
  }

  const handleSaveAddress = async (payload) => {
    try {
      if (editingAddressId) {
        await adminApi.updateAddress(editingAddressId, payload)
        setToastMessage('Address updated successfully!')
        setEditingAddressId(null)
        setIsAddingAddress(false)
      } else {
        await adminApi.addAddress(payload)
        setToastMessage('Address added successfully!')
        setIsAddingAddress(false)
      }
      const res = await adminApi.getProfile()
      if (res?.data?.user?.addresses) {
        setAddresses(res.data.user.addresses)
      }
      setAddressData({
        label: 'Home',
        country: 'PH',
        streetLine1: '',
        streetLine2: '',
        province: '',
        city: '',
        barangay: '',
        stateProvince: '',
        postalZipCode: '',
        isDefault: true,
      })
      setLocationData(prev => ({ ...prev, cities: [], barangays: [] }))
    } catch (err) {
      alert('Failed to save address: ' + err.message)
    }
  }

  const handleDeleteAddress = async () => {
    if (!confirm.open || !confirm.addressId) return
    setConfirm(c => ({ ...c, isBusy: true }))
    try {
      await adminApi.deleteAddress(confirm.addressId)
      setToastMessage('Address deleted successfully!')
      setConfirm(c => ({ ...c, open: false, addressId: null, isBusy: false }))
      const res = await adminApi.getProfile()
      if (res?.data?.user?.addresses) {
        setAddresses(res.data.user.addresses)
      }
    } catch (err) {
      setConfirm(c => ({ ...c, isBusy: false }))
      alert("Failed to delete address: " + err.message)
    }
  }

  const setDefaultAddress = async (addressId) => {
    try {
      await adminApi.updateAddress(addressId, { isDefault: true })
      setToastMessage('Default address updated!')
      const res = await adminApi.getProfile()
      if (res?.data?.user?.addresses) {
        setAddresses(res.data.user.addresses)
      }
    } catch (err) {
      alert("Failed to set default address: " + err.message)
    }
  }

  const openDeleteConfirm = (addressId) => {
    setConfirm({ open: true, addressId, isBusy: false })
  }

  const closeDeleteConfirm = () => {
    setConfirm({ open: false, addressId: null, isBusy: false })
  }

  const renderProfileContent = () => {
    const fullName = [profileData.firstName, profileData.middleName, profileData.lastName].filter(Boolean).join(' ') || 'User'
    if (profileLoading) {
      return (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--gold-primary)] animate-spin" />
          </div>
        </div>
      )
    }
    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <h2 className="text-2xl font-bold text-white mb-6">My Profile</h2>
        <div className="flex items-center gap-6 mb-10 pb-8 border-b border-[var(--border)]">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--bg-primary)] border-2 border-[var(--gold-primary)]">
            <img src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent([profileData.firstName, profileData.lastName].filter(Boolean).join(' '))}&background=D4AF55&color=1a1a1a&bold=true`} alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-xl font-bold text-white mb-1">{fullName}</p>
            <p className="text-sm text-[var(--text-muted)] mb-3">{profileData.email}</p>
            <div className="flex gap-2">
              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] cursor-pointer transition-colors ${!isEditingProfile && 'opacity-50 pointer-events-none'}`}>
                <Upload className="w-3.5 h-3.5" />
                Photo
                <input type="file" accept="image/*" onChange={handleImageChange} disabled={!isEditingProfile} className="hidden" />
              </label>
              <button type="button" onClick={() => setIsEditingProfile(!isEditingProfile)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors">
                {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-white mb-2">First Name</label>
            <input type="text" value={profileData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} disabled={!isEditingProfile} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">Last Name</label>
            <input type="text" value={profileData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} disabled={!isEditingProfile} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">Middle Initial (Optional)</label>
            <input type="text" value={profileData.middleName} maxLength={1} onChange={e => handleInputChange('middleName', e.target.value)} disabled={!isEditingProfile} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">Email</label>
            <input type="email" value={profileData.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">Phone Number</label>
            <input type="tel" value={profileData.phone} onChange={e => handleInputChange('phone', e.target.value)} disabled={!isEditingProfile} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white mb-2">Gender</label>
            <div className={`flex items-center gap-4 text-sm ${isEditingProfile ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)] opacity-50'}`}>
              {['male', 'female', 'other'].map(value => (
                <label key={value} className={`inline-flex items-center gap-2 ${isEditingProfile ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <span className={`w-4 h-4 rounded-full border-2 ${profileData.gender === value ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]' : 'border-[var(--border)]'} flex items-center justify-center`}>
                    {profileData.gender === value && <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dark)]" />}
                  </span>
                  <span className="capitalize">{value}</span>
                  <input type="radio" className="hidden" checked={profileData.gender === value} onChange={() => isEditingProfile && handleInputChange('gender', value)} disabled={!isEditingProfile} />
                </label>
              ))}
            </div>
          </div>
        </div>
        {isEditingProfile && (
          <button type="button" onClick={handleSaveProfile} className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        )}
      </div>
    )
  }

  const renderAddressesContent = () => {
    const canShowAddButton = !isAddingAddress && !editingAddressId

    if (addressesLoading) {
      return (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--gold-primary)] animate-spin" />
          </div>
        </div>
      )
    }

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">My Addresses</h2>
            <p className="text-sm text-[var(--text-muted)]">Manage your shipping addresses</p>
          </div>
          {canShowAddButton && (
            <button
              onClick={() => setIsAddingAddress(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--gold-primary)] text-sm font-semibold text-[var(--gold-primary)] hover:bg-[var(--gold-primary)] hover:text-[var(--text-dark)] transition-colors"
            >
              + Add New Address
            </button>
          )}
        </div>

        {isAddingAddress || editingAddressId ? (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setIsAddingAddress(false)
                  setEditingAddressId(null)
                  setAddressData({
                    label: 'Home',
                    country: 'PH',
                    streetLine1: '',
                    streetLine2: '',
                    province: '',
                    city: '',
                    barangay: '',
                    stateProvince: '',
                    postalZipCode: '',
                    isDefault: true,
                  })
                  setLocationData(prev => ({ ...prev, cities: [], barangays: [] }))
                }}
                className="text-[var(--gold-primary)] hover:underline text-sm font-semibold flex items-center gap-1"
              >
                Back
              </button>
              <span className="text-white font-semibold">{editingAddressId ? 'Edit Address' : 'Add New Address'}</span>
            </div>

            <AddressForm
              initialAddress={addressData}
              onSubmit={handleSaveAddress}
              onCancel={() => {
                setIsAddingAddress(false)
                setEditingAddressId(null)
                setAddressData({
                  label: 'Home',
                  country: 'PH',
                  streetLine1: '',
                  streetLine2: '',
                  province: '',
                  city: '',
                  barangay: '',
                  stateProvince: '',
                  postalZipCode: '',
                  isDefault: true,
                })
                setLocationData(prev => ({ ...prev, cities: [], barangays: [] }))
              }}
              submitLabel={editingAddressId ? 'Update Address' : 'Save Address'}
              isSubmitting={isSavingAddress}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {addresses && addresses.length > 0 ? (
              [...addresses]
                .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0))
                .map((addr) => (
                  <div key={addr.address_id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white capitalize">{addr.label || 'Address'}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--gold-primary)] text-[var(--text-dark)]">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {!addr.is_default && (
                          <button onClick={() => setDefaultAddress(addr.address_id)} className="p-2.5 hover:bg-[var(--gold-primary)]/20 hover:border hover:border-[var(--gold-primary)] rounded-lg transition-all duration-150" title="Set as default">
                            <Star className="w-5 h-5 text-[var(--gold-primary)]" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const provinces = getAllProvinces()
                            const matchedProvince = provinces.find((p) => p.name === addr.province || p.psgcCode === addr.province)
                            const provinceCode = matchedProvince?.psgcCode || addr.province || ''

                            const cities = provinceCode ? getMunicipalitiesByProvince(provinceCode) : []
                            const matchedCity = cities.find((c) => c.name === addr.city || c.psgcCode === addr.city)
                            const cityCode = matchedCity?.psgcCode || addr.city || ''

                            const barangays = cityCode ? getBarangaysByMunicipality(cityCode) : []

                            setEditingAddressId(addr.address_id)
                            setAddressData({
                              label: addr.label || 'Home',
                              country: addr.country || 'PH',
                              streetLine1: addr.street_line1 || '',
                              streetLine2: addr.street_line2 || '',
                              province: provinceCode,
                              city: cityCode,
                              barangay: addr.barangay || '',
                              stateProvince: addr.province || '',
                              postalZipCode: addr.postal_code || '',
                              isDefault: addr.is_default || false,
                            })
                            setLocationData({ provinces, cities, barangays })
                            setIsAddingAddress(true)
                          }}
                          className="p-2.5 hover:bg-[var(--gold-primary)]/20 hover:border hover:border-[var(--gold-primary)] rounded-lg transition-all duration-150"
                        >
                          <Edit className="w-5 h-5 text-[var(--gold-primary)]" />
                        </button>
                        <button onClick={() => openDeleteConfirm(addr.address_id)} className="p-2.5 hover:bg-red-500/20 hover:border hover:border-red-500 rounded-lg transition-all duration-150">
                          <Trash2 className="w-5 h-5 text-red-400" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--text-muted)] space-y-1">
                      {formatAddressFull(addr)?.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-muted)] text-sm">No address added yet</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">Add an address to streamline your checkout process</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const PAYMENT_METHODS = [
    {
      id: 'bank',
      name: 'Bank Transfer',
      icon: Landmark,
      description: 'Direct bank transfer via BDO Unibank',
      instructions: [
        'Go to your bank\'s online banking or mobile app.',
        'Select "Bank Transfer" as the payment method.',
        'Enter CosmosCraft\'s BDO account details:',
        '  • Bank: BDO Unibank',
        '  • Account Name: CosmosCraft Guitar Shop',
        '  • Account Number: 1234 5678 9012',
        'Transfer the exact amount of your order total.',
        'Upload your proof of payment (screenshot or photo of the transaction receipt) in the Payment Modal.',
      ],
    },
    {
      id: 'gcash',
      name: 'GCash',
      icon: Smartphone,
      description: 'Mobile payment using GCash app',
      instructions: [
        'Open your GCash app.',
        'Go to "Pay" or "Send Money".',
        'Scan the CosmosCraft GCash QR code shown during checkout.',
        'Enter the exact amount of your order total.',
        'Confirm the payment via your GCash PIN or biometrics.',
        'Upload your proof of payment (screenshot of the confirmation) in the Payment Modal.',
      ],
    },
    {
      id: 'maya',
      name: 'Maya',
      icon: Banknote,
      description: 'Pay using Maya (formerly PayMaya)',
      instructions: [
        'Open your Maya app.',
        'Go to "Send Money" or "Pay".',
        'Enter the CosmosCraft Maya account details shown during checkout.',
        'Enter the exact amount of your order total.',
        'Confirm the payment.',
        'Upload your proof of payment screenshot in the Payment Modal.',
      ],
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCardIcon,
      description: 'Visa, Mastercard, or other major cards',
      instructions: [
        'Select "Card Payment" during checkout.',
        'Enter your card number, expiry date, and CVV.',
        'Your payment will be processed securely via our payment gateway.',
        'You will receive a confirmation email once the payment is approved.',
      ],
    },
  ]

  const renderPaymentsContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
      <h2 className="text-2xl font-bold text-white mb-1">Payment Methods</h2>
      <p className="text-sm text-[var(--text-muted)] mb-8">
        View available payment options and instructions
      </p>
      <div className="grid gap-6">
        {PAYMENT_METHODS.map((method) => {
          const Icon = method.icon
          return (
            <div
              key={method.id}
              className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--gold-primary)]/20 to-[var(--gold-secondary)]/20 border border-[var(--gold-primary)]/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[var(--gold-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white">{method.name}</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{method.description}</p>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
                <p className="text-xs font-semibold text-[var(--gold-primary)] uppercase tracking-wider mb-2">
                  Instructions
                </p>
                <ol className="space-y-1.5">
                  {method.instructions.map((instruction, idx) => (
                    <li key={idx} className="text-sm text-[var(--text-muted)] flex items-start gap-2">
                      <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-[var(--gold-primary)] shrink-0" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const currentMenu = menuItems.find(item => item.id === activeSection)

  const isToastError = toastMessage?.startsWith?.('Failed') || false

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-12">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-24 left-1/2 z-[100] px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2 ${isToastError ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)]'}`}
          >
            {isToastError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirm.open}
        title="Delete Address"
        description="Are you sure you want to delete this address? This action cannot be undone."
        variant="danger"
        isBusy={confirm.isBusy}
        onConfirm={handleDeleteAddress}
        onCancel={closeDeleteConfirm}
      />
      <ConfirmModal
        open={isLogoutConfirmOpen}
        title="Logout"
        description="Are you sure you want to log out?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />
      <ConfirmModal
        open={isPasswordConfirmOpen}
        title={isSocialOnlyAccount ? 'Save Password' : 'Change Password'}
        description="Are you sure you want to change your password?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="warning"
        isBusy={isPasswordLoading}
        onConfirm={handleConfirmPasswordChange}
        onCancel={() => setIsPasswordConfirmOpen(false)}
      />

      {/* Cancel Project Modal - Detailed Warning */}
      <AnimatePresence>
        {isCancelProjectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCancelProjectModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-xl rounded-3xl border border-red-500/30 bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white text-lg sm:text-xl font-bold">Cancel Project</h3>
                    <p className="text-xs text-[var(--text-muted)] truncate max-w-[240px] sm:max-w-md">
                      {cancelProjectTarget?.name || 'Custom Build Project'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCancelProjectModal}
                  disabled={isCancellingProject}
                  className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                  aria-label="Close cancel project modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="overflow-y-auto pr-1 -mr-1 py-4 space-y-4 flex-1">
                {/* Permanent Action Notice */}
                <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/15 via-red-500/10 to-transparent p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm text-red-200/90 leading-relaxed">
                        <strong className="text-red-400 font-semibold">This action is permanent.</strong> Once cancelled, <strong className="text-white">"{cancelProjectTarget?.name || 'This project'}"</strong> will stop at its current build stage and cannot be resumed or reactivated. If you wish to continue this build in the future, you must place a new order.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Project Summary Card */}
                {cancelProjectTarget && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Build Reference</span>
                      <span className="text-xs font-mono font-semibold text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        {cancelProjectTarget.custom_build_id || cancelProjectTarget.project_id?.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Current Status</span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 capitalize">
                        {formatStatus(cancelProjectTarget.status)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Manufacturing Progress</span>
                        <span className="font-bold text-[var(--gold-primary)]">{cancelProjectTarget.progress || 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--surface-dark)] rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-[var(--gold-primary)] transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, Number(cancelProjectTarget.progress) || 0))}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Payment Plan</span>
                      <span className="text-xs font-semibold text-white capitalize">
                        {cancelProjectTarget.order_payment_plan === 'installment' ? 'Installment / Down Payment' : 'Full Payment'}
                      </span>
                    </div>
                    {cancelProjectPaymentLoading ? (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-28 bg-white/10 rounded animate-pulse" />
                          <div className="h-3.5 w-24 bg-white/10 rounded animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-32 bg-white/10 rounded animate-pulse" />
                          <div className="h-4 w-28 bg-[var(--gold-primary)]/20 rounded animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                          <div className="h-5 w-24 bg-white/10 rounded-full animate-pulse" />
                        </div>
                      </div>
                    ) : cancelProjectPayment ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Payment Method</span>
                          <span className="text-xs font-semibold text-white capitalize">{cancelProjectPayment.method?.replace(/_/g, ' ') || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Amount Submitted</span>
                          <span className="text-xs font-bold text-[var(--gold-primary)]">{formatCurrency(cancelProjectPayment.amount)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">Payment Status</span>
                          <span className={`text-xs font-semibold capitalize ${cancelProjectPayment.status === 'verified' ? 'text-green-400' :
                            cancelProjectPayment.status === 'for_verification' || cancelProjectPayment.status === 'pending' ? 'text-amber-400' :
                              cancelProjectPayment.status === 'rejected' ? 'text-red-400' :
                                'text-white'
                            }`}>{formatStatus(cancelProjectPayment.status)}</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Refund Notice for Not Started Builds */}
                {cancelProjectTarget && String(cancelProjectTarget.status || '').toLowerCase() === 'not_started' && (
                  cancelProjectPaymentLoading ? (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-400/20 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2 py-0.5">
                          <div className="h-3 w-3/4 bg-blue-400/20 rounded" />
                          <div className="h-3 w-1/2 bg-blue-400/10 rounded" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-transparent p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {cancelProjectPayment?.status === 'verified' ? (
                            <CheckCircle className="w-5 h-5 text-blue-400 shrink-0" />
                          ) : cancelProjectPayment?.status === 'for_verification' || cancelProjectPayment?.status === 'pending' ? (
                            <Clock className="w-5 h-5 text-blue-400 shrink-0" />
                          ) : (
                            <Info className="w-5 h-5 text-blue-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-blue-200/90 leading-relaxed">
                          {cancelProjectPayment?.status === 'verified' ? (
                            <>Your payment has been verified. Your refund request will be submitted automatically and is now waiting for admin approval.</>
                          ) : cancelProjectPayment?.status === 'for_verification' || cancelProjectPayment?.status === 'pending' ? (
                            <>Your payment is still being verified by the admin. Once your payment is verified, your refund request can proceed.</>
                          ) : (
                            <>No refund is available for this payment status.</>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Build State Preview — shown when project has started */}
                {cancelProjectTarget && String(cancelProjectTarget.status || '').toLowerCase() !== 'not_started' && (
                  <>
                    {cancelBuildPreviewLoading ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex items-center justify-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                        <span className="text-sm text-amber-300 font-medium">Loading build state...</span>
                      </div>
                    ) : cancelBuildPreview?.has_progress ? (
                      <div className="space-y-4">
                        {/* Build state explanation */}
                        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-transparent p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                              This project has already started. Your down payment was used to purchase parts and materials. <strong className="text-amber-300">You will receive the guitar in its current build state</strong> instead of a refund.
                            </p>
                          </div>
                        </div>

                        {/* Milestone breakdown */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-semibold mb-3">
                            Current Build State — <span className="text-[var(--gold-primary)]">{cancelBuildPreview.progress}% Complete</span>
                          </p>
                          <div className="space-y-2">
                            {(cancelBuildPreview.stages || []).map((stage, idx) => (
                              <div key={stage.milestone_id || idx} className="flex items-center gap-2.5">
                                {stage.status === 'completed' ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : stage.status === 'in_progress' ? (
                                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                                )}
                                <span className={`text-xs sm:text-sm ${stage.status === 'completed' ? 'text-emerald-300 font-medium' : stage.status === 'in_progress' ? 'text-amber-300 font-medium' : 'text-[var(--text-muted)]'}`}>
                                  {stage.title}
                                </span>
                                {stage.total_subtasks > 0 && (
                                  <span className="text-xs text-[var(--text-muted)] ml-auto">{stage.completed_subtasks}/{stage.total_subtasks}</span>
                                )}
                              </div>
                            ))}
                          </div>
                          {cancelBuildPreview.amount_paid > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)]">Amount Paid</span>
                              <span className="text-xs font-bold text-[var(--gold-primary)]">{formatCurrency(cancelBuildPreview.amount_paid)}</span>
                            </div>
                          )}
                        </div>

                        {/* Claim method selection */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            How would you like to receive your guitar? <span className="text-red-400">*</span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {[
                              { value: 'pickup', title: 'Pick Up at Shop', subtitle: 'Visit our shop to collect your guitar', icon: Package },
                              { value: 'courier', title: 'Courier Delivery', subtitle: "We'll arrange delivery to your address", icon: Truck },
                            ].map((opt) => {
                              const isSelected = cancelClaimMethod === opt.value
                              const IconComp = opt.icon
                              return (
                                <label
                                  key={opt.value}
                                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${isSelected
                                      ? 'border-amber-500/70 bg-gradient-to-br from-amber-500/15 to-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/40'
                                      : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-amber-500/40 hover:bg-white/[0.02]'
                                    }`}
                                >
                                  <input
                                    type="radio"
                                    name="claim-method"
                                    value={opt.value}
                                    checked={isSelected}
                                    onChange={() => setCancelClaimMethod(opt.value)}
                                    className="mt-1 h-4 w-4 accent-amber-500 shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <IconComp className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
                                      <span className={`text-sm font-semibold block truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>{opt.title}</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{opt.subtitle}</p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>

                          {/* Courier details */}
                          {cancelClaimMethod === 'courier' && (
                            <div className="mt-3 space-y-2">
                              <input
                                type="text"
                                value={cancelClaimRecipientName}
                                onChange={(e) => setCancelClaimRecipientName(e.target.value)}
                                placeholder="Recipient name"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                              />
                              <input
                                type="text"
                                value={cancelClaimRecipientContact}
                                onChange={(e) => setCancelClaimRecipientContact(e.target.value)}
                                placeholder="Contact number"
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all"
                              />
                              <textarea
                                value={cancelClaimDeliveryInstructions}
                                onChange={(e) => setCancelClaimDeliveryInstructions(e.target.value)}
                                placeholder="Delivery instructions (optional)"
                                rows={2}
                                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 focus:outline-none resize-none transition-all"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300/90 leading-relaxed">
                            This project has already started but no build progress has been recorded yet. Please contact support for assistance.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Explicit Confirmation Checkbox */}
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cancelProjectConfirmed}
                      onChange={(e) => setCancelProjectConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-red-500 rounded shrink-0 cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-white/90 leading-snug font-medium select-none">
                      {cancelBuildPreview?.has_progress
                        ? 'I understand that my down payment is non-refundable and I will receive the guitar in its current unfinished state. I want to cancel this project.'
                        : 'I understand that cancellation is permanent once approved by the admin. I want to cancel this project.'
                      }
                    </span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={closeCancelProjectModal}
                    disabled={isCancellingProject}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Keep Project
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelProject}
                    disabled={!cancelProjectConfirmed || isCancellingProject}
                    className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isCancellingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCancellingProject ? 'Cancelling...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Cancellation Modal (Current Build Claim request flow) */}
      <AnimatePresence>
        {isCancelWithOptionsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCancelWithOptionsModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-xl rounded-3xl border border-amber-500/30 bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white text-lg sm:text-xl font-bold">Request Cancellation</h3>
                    <p className="text-xs text-[var(--text-muted)] truncate max-w-[240px] sm:max-w-md">
                      {cancelWithOptionsTarget?.name || 'Custom Build Project'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCancelWithOptionsModal}
                  disabled={isCancellingWithOptions || isWithdrawingCancelRequest}
                  className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                  aria-label="Close request cancellation modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="overflow-y-auto pr-1 -mr-1 py-4 space-y-4 flex-1">
                {cancelWithOptionsTarget?.cancel_requested_at && !cancelWithOptionsTarget?.cancel_approved_at ? (
                  /* Pending Cancellation Review View */
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="relative mt-0.5">
                          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-amber-300">Cancellation Request Pending Review</p>
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium">
                              Under Admin Review
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
                            Your request to cancel this custom build has been submitted and is currently being evaluated by our workshop administration team.
                          </p>
                          {cancelWithOptionsTarget.cancel_requested_at && (
                            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                              Submitted: <span className="text-white">{new Date(cancelWithOptionsTarget.cancel_requested_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Request Summary Card */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 sm:p-5 space-y-3.5">
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-semibold">Request Details</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Fulfillment Method</span>
                          <div className="flex items-center gap-2">
                            {cancelWithOptionsTarget.cancel_option === 'ship_to_address' || cancelWithOptionsTarget.cancel_option === 'ship_unfinished' ? (
                              <>
                                <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-sm font-semibold text-white">Ship to Address</span>
                              </>
                            ) : (
                              <>
                                <Package className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-sm font-semibold text-white">Pick Up at Shop</span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">
                            {cancelWithOptionsTarget.cancel_option === 'ship_to_address' || cancelWithOptionsTarget.cancel_option === 'ship_unfinished'
                              ? 'Courier delivery of unfinished guitar and parts'
                              : 'In-person collection from our workshop'}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">Build Progress</span>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{cancelWithOptionsTarget.progress || 0}% Complete</span>
                            <span className="text-xs text-[var(--gold-primary)] font-medium capitalize">{formatStatus(cancelWithOptionsTarget.status)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Address if Shipping */}
                      {(cancelWithOptionsTarget.cancel_option === 'ship_to_address' || cancelWithOptionsTarget.cancel_option === 'ship_unfinished') && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5 space-y-1">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block mb-1 font-semibold flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" /> Delivery Address
                          </span>
                          {(() => {
                            const snap = cancelWithOptionsTarget.cancel_address_snapshot
                              ? (typeof cancelWithOptionsTarget.cancel_address_snapshot === 'string'
                                ? JSON.parse(cancelWithOptionsTarget.cancel_address_snapshot)
                                : cancelWithOptionsTarget.cancel_address_snapshot)
                              : null
                            const recipient = snap?.recipient_name || cancelWithOptionsTarget.customer_name || 'Customer'
                            const phone = snap?.phone || cancelWithOptionsTarget.customer_phone
                            const addrLines = snap ? [
                              snap.line1,
                              snap.line2,
                              snap.barangay,
                              snap.city,
                              snap.province,
                              snap.postal_code,
                              snap.country
                            ].filter(Boolean).join(', ') : (
                              cancelWithOptionsTarget.cancel_address_line1
                                ? [
                                  cancelWithOptionsTarget.cancel_address_line1,
                                  cancelWithOptionsTarget.cancel_address_line2,
                                  cancelWithOptionsTarget.cancel_address_barangay,
                                  cancelWithOptionsTarget.cancel_address_city,
                                  cancelWithOptionsTarget.cancel_address_province,
                                  cancelWithOptionsTarget.cancel_address_postal_code,
                                  cancelWithOptionsTarget.cancel_address_country
                                ].filter(Boolean).join(', ')
                                : 'No delivery address recorded'
                            )

                            return (
                              <div className="text-xs space-y-0.5 text-white/90">
                                <p className="font-semibold text-white">{recipient} {phone && <span className="font-normal text-[var(--text-muted)]">({phone})</span>}</p>
                                <p className="text-[var(--text-muted)] leading-relaxed">{addrLines}</p>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {cancelWithOptionsTarget.cancel_reason && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5">
                          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] block mb-1.5 font-medium">Customer Reason</span>
                          <p className="text-sm text-white/90 leading-relaxed break-words bg-black/20 p-2.5 rounded-lg border border-white/5 italic">
                            "{cancelWithOptionsTarget.cancel_reason}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-200/80 leading-relaxed">
                        If you changed your mind and wish to keep building this instrument, you can withdraw your cancellation request below at any time before admin approval.
                      </p>
                    </div>

                    {/* Pending Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={closeCancelWithOptionsModal}
                        disabled={isWithdrawingCancelRequest}
                        className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Keep Request (Close)
                      </button>
                      <button
                        type="button"
                        onClick={handleWithdrawCancelRequest}
                        disabled={isWithdrawingCancelRequest}
                        className="flex-1 rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isWithdrawingCancelRequest && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isWithdrawingCancelRequest ? 'Withdrawing...' : 'Withdraw Cancellation Request'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Submit Cancellation Request Form */
                  <div className="space-y-4">
                    {/* Project Overview Card */}
                    {cancelWithOptionsTarget && (

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="uppercase tracking-[0.14em] text-[var(--text-muted)] font-medium">
                            Manufacturing Progress
                          </span>

                          <span className="font-bold text-[var(--gold-primary)]">
                            {Math.min(
                              100,
                              Math.max(0, Number(cancelWithOptionsTarget.progress) || 0)
                            )}
                            %
                          </span>
                        </div>

                        <div className="h-2 w-full bg-[var(--surface-dark)] rounded-full overflow-hidden border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-[var(--gold-primary)] transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, Number(cancelWithOptionsTarget.progress) || 0)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>


                    )}

                    {/* Policy & Material Notice */}
                    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                            <strong className="text-amber-300 font-semibold">Active Production Notice: </strong>
                            This guitar is currently in production. In accordance with custom build terms, initial down payments are non-refundable as parts and custom labor have already been allocated. <strong className="text-white">You will receive the guitar in its current unfinished state.</strong>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Fulfillment Method Selection */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Fulfillment Method <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          {
                            value: 'ship_to_address',
                            title: 'Ship to Address',
                            subtitle: 'Courier delivery of unfinished guitar and parts',
                            icon: Truck,
                          },
                          {
                            value: 'pickup_at_shop',
                            title: 'Pick Up at Shop',
                            subtitle: 'In-person collection from our workshop',
                            icon: Package,
                          },
                        ].map((opt) => {
                          const isSelected = cancelOption === opt.value
                          const IconComp = opt.icon
                          return (
                            <label
                              key={opt.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-all ${isSelected
                                ? 'border-amber-500/70 bg-gradient-to-br from-amber-500/15 to-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)] ring-1 ring-amber-500/40'
                                : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-amber-500/40 hover:bg-white/[0.02]'
                                }`}
                            >
                              <input
                                type="radio"
                                name="cancel-option"
                                value={opt.value}
                                checked={isSelected}
                                onChange={() => {
                                  setCancelOption(opt.value)
                                  if (opt.value === 'ship_to_address' && !selectedCancelAddressId && addresses && addresses.length > 0) {
                                    const def = addresses.find(a => a.is_default) || addresses[0]
                                    setSelectedCancelAddressId(def?.address_id || null)
                                  }
                                }}
                                className="mt-1 h-4 w-4 accent-amber-500 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <IconComp className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-[var(--text-muted)]'}`} />
                                  <span className={`text-sm font-semibold block truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                    {opt.title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                                  {opt.subtitle}
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      {/* Ship to Address Details: Saved Addresses & Add New Address */}
                      {cancelOption === 'ship_to_address' && (
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Saved Address <span className="text-red-400">*</span>
                            </span>
                            {!isAddingCancelAddress && (
                              <button
                                type="button"
                                onClick={() => setIsAddingCancelAddress(true)}
                                className="text-xs font-semibold text-[var(--gold-primary)] hover:underline flex items-center gap-1"
                              >
                                + Add New Address
                              </button>
                            )}
                          </div>

                          {cancelAddressSuccessMsg && (
                            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-300">
                              <span className="flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> {cancelAddressSuccessMsg}
                              </span>
                              <span className="text-[11px] text-emerald-400 font-medium">Selected for this request</span>
                            </div>
                          )}

                          {isAddingCancelAddress ? (
                            <div className="rounded-xl border border-amber-500/30 bg-[var(--surface-dark)] p-4 space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                                <span className="text-xs font-bold text-amber-300">New Delivery Address</span>
                                <button
                                  type="button"
                                  onClick={() => setIsAddingCancelAddress(false)}
                                  className="text-xs text-[var(--text-muted)] hover:text-white transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                              <AddressForm
                                initialAddress={{ label: 'Home', country: 'PH', isDefault: false }}
                                onSubmit={handleSaveCancelAddress}
                                onCancel={() => setIsAddingCancelAddress(false)}
                                submitLabel="Save & Select Address"
                                isSubmitting={isSavingCancelAddress}
                                showCategory={true}
                              />
                            </div>
                          ) : (
                            <>
                              {addresses && addresses.length > 0 ? (
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                  {addresses.map((addr) => {
                                    const isAddrSelected = selectedCancelAddressId === addr.address_id
                                    return (
                                      <label
                                        key={addr.address_id}
                                        onClick={() => setSelectedCancelAddressId(addr.address_id)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isAddrSelected
                                            ? 'border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/40 shadow-sm'
                                            : 'border-[var(--border)] bg-[var(--surface-dark)] hover:border-amber-500/40 hover:bg-white/[0.02]'
                                          }`}
                                      >
                                        <input
                                          type="radio"
                                          name="cancel-address-radio"
                                          checked={isAddrSelected}
                                          onChange={() => setSelectedCancelAddressId(addr.address_id)}
                                          className="mt-1 h-4 w-4 accent-amber-500 shrink-0"
                                        />
                                        <div className="flex-1 min-w-0 text-xs">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-bold text-white capitalize">{addr.label || 'Home'}</span>
                                            {addr.is_default && (
                                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--gold-primary)] text-[var(--text-dark)] font-bold">
                                                Default
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[var(--text-muted)] leading-relaxed">
                                            {formatAddress(addr)}
                                          </p>
                                        </div>
                                      </label>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
                                  <MapPin className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-1 opacity-50" />
                                  <p className="text-xs text-[var(--text-muted)]">No saved delivery addresses found.</p>
                                  <button
                                    type="button"
                                    onClick={() => setIsAddingCancelAddress(true)}
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold-primary)] hover:underline"
                                  >
                                    + Add New Address
                                  </button>
                                </div>
                              )}

                              {!selectedCancelAddressId && (
                                <p className="text-[11px] text-amber-400 flex items-center gap-1 pt-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Please select a delivery address.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Pickup at Shop Note */}
                      {cancelOption === 'pickup_at_shop' && (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <Package className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>No delivery address is required. You will be notified when your guitar and parts are ready for collection at our workshop.</span>
                        </div>
                      )}
                    </div>

                    {/* Cancellation Reason with Quick Tags */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Reason for Cancellation <span className="text-red-400">*</span>
                        </label>
                        <span className="text-[11px] text-[var(--text-muted)]">{cancelWithOptionsReason.length}/500</span>
                      </div>

                      {/* Quick Suggestion Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'Budget / financial constraints',
                          'Timeline / schedule change',
                          'Design revision needed',
                          'Personal circumstances',
                        ].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setCancelWithOptionsReason(tag)}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${cancelWithOptionsReason === tag
                              ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                              : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-white hover:border-amber-500/30'
                              }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={cancelWithOptionsReason}
                        onChange={(e) => setCancelWithOptionsReason(e.target.value)}
                        placeholder="Please provide details regarding your cancellation request..."
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none resize-none transition-all"
                      />
                    </div>

                    {/* Checkbox Acknowledgment */}
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cancelWithOptionsConfirmed}
                          onChange={(e) => setCancelWithOptionsConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-amber-500 rounded shrink-0 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm text-white/90 leading-snug font-medium select-none">
                          I understand that my down payment is non-refundable and I will receive the guitar in its current unfinished state. I wish to submit this cancellation request for admin review.
                        </span>
                      </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={closeCancelWithOptionsModal}
                        disabled={isCancellingWithOptions || isSavingCancelAddress}
                        className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Keep Project
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelWithOptions}
                        disabled={
                          !cancelWithOptionsReason.trim() ||
                          !cancelWithOptionsConfirmed ||
                          (cancelOption === 'ship_to_address' && !selectedCancelAddressId) ||
                          isCancellingWithOptions ||
                          isSavingCancelAddress
                        }
                        className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {isCancellingWithOptions && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isCancellingWithOptions ? 'Submitting Request...' : 'Submit Cancellation Request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hold Build Modal */}
      <AnimatePresence>
        {isHoldProjectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeHoldProjectModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-amber-500/30 bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={closeHoldProjectModal}
                disabled={isHoldingProject}
                className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close hold project modal"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-5">
                <Clock className="w-7 h-7 text-amber-400" />
              </div>

              <h3 className="text-white text-xl font-bold mb-2">Hold Build</h3>

              {holdProjectTarget?.name && (
                <p className="text-sm text-[var(--text-muted)] mb-5">
                  Pause manufacturing for <span className="text-white font-semibold">{holdProjectTarget.name}</span>
                </p>
              )}

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-5">
                <p className="text-sm text-amber-300 leading-relaxed">
                  <AlertCircle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  Placing this build on hold will pause all manufacturing progress. Staff will not be able to complete or start any build tasks until you resume the project. You can resume it at any time from your dashboard.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    Hold Option
                  </label>
                  <div className="grid gap-2">
                    {[
                      { value: 'resume_later', label: 'Resume Later', desc: 'Pause the project entirely. You will resume when ready.' },
                      { value: 'hold_before_next_step', label: 'Hold Before Next Step', desc: 'Complete the current step, then pause before moving to the next.' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${holdOption === opt.value
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-[var(--border)] hover:border-amber-500/30'
                          }`}
                      >
                        <input
                          type="radio"
                          name="hold-option"
                          value={opt.value}
                          checked={holdOption === opt.value}
                          onChange={() => setHoldOption(opt.value)}
                          className="mt-1 h-4 w-4 accent-amber-500"
                        />
                        <div>
                          <span className="text-sm text-white font-medium block">{opt.label}</span>
                          <span className="text-xs text-[var(--text-muted)] mt-0.5 block">{opt.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    Reason for Hold <span className="text-red-400">*</span>
                  </label>
                  <div className="grid gap-2">
                    {HOLD_REASONS.map((reason) => {
                      const isSelected = holdReason === reason
                      return (
                        <label
                          key={reason}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${isSelected
                            ? 'border-amber-500/50 bg-amber-500/10'
                            : 'border-[var(--border)] hover:border-amber-500/30'
                            }`}
                        >
                          <input
                            type="radio"
                            name="hold-reason"
                            value={reason}
                            checked={isSelected}
                            onChange={() => {
                              setHoldReason(reason)
                              if (reason !== 'Others') setHoldCustomReason('')
                            }}
                            className="mt-1 h-4 w-4 accent-amber-500"
                          />
                          <span className="text-sm text-white">{reason}</span>
                        </label>
                      )
                    })}
                  </div>
                  {holdReason === 'Others' && (
                    <div className="mt-4">
                      <textarea
                        value={holdCustomReason}
                        onChange={(e) => setHoldCustomReason(e.target.value)}
                        placeholder="Please specify your reason..."
                        maxLength={300}
                        rows={3}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-amber-500/50 focus:outline-none"
                      />
                      <p className="mt-1 text-right text-xs text-[var(--text-muted)]">{holdCustomReason.length}/300</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeHoldProjectModal}
                  disabled={isHoldingProject}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleHoldProject}
                  disabled={!holdReason.trim() || (holdReason === 'Others' && !holdCustomReason.trim()) || isHoldingProject}
                  className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-black hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isHoldingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isHoldingProject ? 'Placing on Hold...' : 'Confirm Hold'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume / Continue Build Modal */}
      <AnimatePresence>
        {isResumeProjectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeResumeProjectModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={closeResumeProjectModal}
                disabled={isResumingProject}
                className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close resume project modal"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-5">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>

              <h3 className="text-white text-xl font-bold mb-2">Continue Build</h3>

              {resumeProjectTarget?.name && (
                <p className="text-sm text-[var(--text-muted)] mb-1">
                  Resume manufacturing for <span className="text-white font-semibold">{resumeProjectTarget.name}</span>
                </p>
              )}

              <p className="text-sm text-[var(--text-muted)] mb-5">
                This will change the status back to <span className="text-emerald-400 font-semibold">In Progress</span>. Staff will be able to continue working on tasks from the last completed step. All completed tasks and progress will remain unchanged.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeResumeProjectModal}
                  disabled={isResumingProject}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Keep On Hold
                </button>
                <button
                  type="button"
                  onClick={handleResumeProject}
                  disabled={isResumingProject}
                  className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResumingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isResumingProject ? 'Resuming...' : 'Confirm & Resume'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCancelOrderModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCancelOrderModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={closeCancelOrderModal}
                disabled={isCancellingOrder}
                className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close cancel order modal"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-xl font-bold text-white pr-8">Cancel Order</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {cancelOrderTarget?.order_number ? `Order ${cancelOrderTarget.order_number}` : 'This order'} will be cancelled. Please tell us why.
              </p>

              <div className="mt-5 space-y-3">
                {ORDER_CANCEL_REASONS.map((reason) => {
                  const isSelected = cancelOrderReason === reason
                  return (
                    <label
                      key={reason}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${isSelected
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10'
                        : 'border-[var(--border)] hover:border-[var(--gold-primary)]/40'
                        }`}
                    >
                      <input
                        type="radio"
                        name="cancel-order-reason"
                        value={reason}
                        checked={isSelected}
                        onChange={(event) => setCancelOrderReason(event.target.value)}
                        className="h-4 w-4 accent-[var(--gold-primary)]"
                      />
                      <span className="text-sm text-white">{reason}</span>
                    </label>
                  )
                })}
              </div>

              {cancelOrderReason === 'Others' && (
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Please specify your reason
                  </label>
                  <textarea
                    value={cancelOrderCustomReason}
                    onChange={(event) => setCancelOrderCustomReason(event.target.value)}
                    maxLength={200}
                    rows={4}
                    placeholder="Type your reason here..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--gold-primary)] focus:outline-none"
                  />
                  <p className="mt-1 text-right text-xs text-[var(--text-muted)]">{cancelOrderCustomReason.length}/200</p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeCancelOrderModal}
                  disabled={isCancellingOrder}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={!getResolvedCancelReason() || isCancellingOrder}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCancellingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCancellingOrder ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCancelAppointmentModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeCancelAppointmentModal()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={closeCancelAppointmentModal}
                disabled={isCancellingAppointment}
                className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close cancel appointment modal"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-xl font-bold text-white pr-8">Cancel Appointment</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Are you sure you want to cancel this appointment? Please provide a reason for cancellation.
              </p>

              <div className="mt-5">
                <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Reason for Cancellation <span className="text-red-400">*</span>
                </label>
                <div className="space-y-2">
                  {APPOINTMENT_CANCEL_REASONS.map((reason) => {
                    const isSelected = cancelAppointmentReason === reason
                    return (
                      <label
                        key={reason}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${isSelected
                          ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10'
                          : 'border-[var(--border)] hover:border-[var(--gold-primary)]/40'
                          }`}
                      >
                        <input
                          type="radio"
                          name="cancel-appointment-reason"
                          value={reason}
                          checked={isSelected}
                          onChange={(event) => setCancelAppointmentReason(event.target.value)}
                          className="h-4 w-4 accent-[var(--gold-primary)]"
                        />
                        <span className="text-sm text-white">{reason}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeCancelAppointmentModal}
                  disabled={isCancellingAppointment}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  disabled={!cancelAppointmentReason.trim() || isCancellingAppointment}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCancellingAppointment && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCancellingAppointment ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Payment Confirmed Warning Modal ───────────────────────────────── */}
      <AnimatePresence>
        {isPaymentConfirmedModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleKeepAppointment()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-red-500/30 bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Payment Already Confirmed</h3>
              </div>

              <p className="text-sm text-[var(--text-muted)] mb-4">
                Your payment has already been confirmed by the administrator.
                Payments made through <strong>GCash, E-Wallet, or E-Bank</strong> are{' '}
                <strong className="text-red-400">non-refundable</strong> once they have been confirmed.
                By cancelling this appointment, you acknowledge that the payment cannot be refunded.
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentConfirmedModalOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentConfirmedModalOpen(false)
                    openCancelAppointmentModal(cancelAppointmentTarget)
                  }}
                  className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600 transition-colors"
                >
                  Cancel Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Request Refund Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isRequestRefundModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleKeepAppointment()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 sm:p-7 shadow-2xl"
            >
              <button
                type="button"
                onClick={handleKeepAppointment}
                disabled={isRequestingRefund}
                className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <h3 className="text-xl font-bold text-white mb-2">Request Refund</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)] mb-4">
                Your payment has <strong>not yet been confirmed</strong> by the administrator.
                You may submit a refund request before cancelling this appointment.
                Once your refund request is reviewed, the administrator will approve or
                reject it based on your payment status.
              </p>

              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  disabled={isRequestingRefund}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-white text-sm focus:border-[var(--gold-primary)] focus:outline-none resize-none disabled:opacity-50"
                  placeholder="Briefly explain the reason for the refund..."
                />
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRequestRefund}
                  disabled={isRequestingRefund}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] py-3 text-sm font-bold text-black hover:bg-[var(--gold-secondary)] transition-colors disabled:opacity-60"
                >
                  {isRequestingRefund && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isRequestingRefund ? 'Submitting...' : 'Request Refund'}
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithoutRefund}
                  disabled={isRequestingRefund}
                  className="rounded-xl border border-[var(--border)] bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Continue Without Refund
                </button>
                <button
                  type="button"
                  onClick={handleKeepAppointment}
                  disabled={isRequestingRefund}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] py-3 text-sm font-semibold text-[var(--text-muted)] hover:text-white transition-colors disabled:opacity-50"
                >
                  Keep Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="grid xl:grid-cols-[1fr_1.4fr] gap-4 sm:gap-6 items-start">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden xl:block h-fit bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] border-2 border-white flex-shrink-0">
                <img src={profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent([profileData.firstName, profileData.lastName].filter(Boolean).join(' '))}&background=D4AF55&color=1a1a1a&bold=true`} alt="User" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {[profileData.firstName, profileData.lastName].filter(Boolean).join(' ') || 'User'}
                </p>
                <p className="truncate text-xs text-white/60">{profileData.email}</p>
              </div>
            </div>

            <div className="px-2 sm:px-3 py-3 sm:py-4 space-y-4 sm:space-y-6 text-sm">
              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
                  MY ACCOUNT
                </p>
                <div className="space-y-1">
                  {menuItems
                    .filter(item => item.group === 'account')
                    .map(item => {
                      const Icon = item.icon
                      const active = activeSection === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active
                            ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-medium border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white border-2 border-transparent'
                            }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )
                    })}
                </div>
              </div>

              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
                  MY ORDERS
                </p>
                <div className="space-y-1">
                  {menuItems
                    .filter(item => item.group === 'orders')
                    .map(item => {
                      const Icon = item.icon
                      const active = activeSection === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active
                            ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-medium border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white border-2 border-transparent'
                            }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Main content */}
          <motion.main
            key={activeSection}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-4"
          >
            <div className="xl:hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-3">
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--text-muted)]">
                SECTIONS
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {menuItems
                  .filter(item => item.id !== 'logout')
                  .map(item => {
                    const Icon = item.icon
                    const active = activeSection === item.id
                    return (
                      <button
                        key={`mobile-${item.id}`}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active
                          ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-[var(--text-dark)]'
                          : 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)]'
                          }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{currentMenu?.label || 'Profile'}</h1>
              </div>
            </div>

            {activeSection === 'profile' && renderProfileContent()}
            {activeSection === 'my-guitar' && renderMyGuitarContent()}
            {activeSection === 'appointments' && renderAppointmentsContent()}
            {activeSection === 'cart' && renderCartContent()}
            {activeSection === 'purchases' && renderPurchasesContent()}

            {activeSection === 'addresses' && renderAddressesContent()}
            {activeSection === 'password' && (
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
                <h2 className="text-2xl font-bold text-white mb-1">Change Password</h2>
                <p className="text-sm text-[var(--text-muted)] mb-10">
                  Update your password regularly for security
                </p>

                {passwordSuccessMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                    <p className="text-green-400 text-sm font-medium">
                      {passwordSuccessMessage}
                    </p>
                  </div>
                )}
                {passwordError && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                    <p className="text-red-400 text-sm font-medium">{passwordError}</p>
                  </div>
                )}
                <div className="space-y-5 max-w-md">
                  {!isSocialOnlyAccount && (
                    <div>
                      <label className="block text-xs font-semibold text-white mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={passwordData.oldPassword}
                        onChange={e => {
                          setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))
                          setPasswordError('')
                        }}
                        className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-white mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={e => {
                          setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))
                          setPasswordError('')
                        }}
                        className="w-full px-4 py-2.5 pr-16 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={e => {
                          setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
                          setPasswordError('')
                        }}
                        className="w-full px-4 py-2.5 pr-16 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={isPasswordLoading}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPasswordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    isSocialOnlyAccount ? 'Save Password' : 'Change Password'
                  )}
                </button>
              </div>
            )}
          </motion.main>
        </div>
      </div>

      {/* Rating Modal */}
      {ratingModalOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md relative">
            <h2 className="text-xl font-bold text-white mb-2">Rate Product</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">How was your experience with this order?</p>

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${star <= rating ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]' : 'text-[var(--border)]'}`}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={ratingText}
              onChange={(e) => setRatingText(e.target.value)}
              placeholder="Leave a review (optional)..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-light)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none mb-6"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRatingModalOrderId(null);
                  setRating(0);
                  setRatingText('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRating}
                disabled={rating === 0}
                className={`flex-1 py-2.5 rounded-xl text-[var(--text-dark)] transition-all font-bold text-sm ${rating === 0
                  ? 'bg-[var(--surface-light)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                  }`}
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Instrument Modal */}
      {showSelectInstrumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md relative">
            <h2 className="text-xl font-bold text-white mb-2">Select Instrument</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Choose an instrument to start your custom build.</p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => navigate('/customize')} className="w-full p-4 rounded-xl border border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 text-left transition-colors">
                <span className="block font-bold text-white mb-1">Custom Guitar</span>
                <span className="block text-xs text-[var(--text-muted)]">Design your own electric or acoustic guitar</span>
              </button>
              <button type="button" onClick={() => navigate('/customize-bass')} className="w-full p-4 rounded-xl border border-[var(--border)] hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 text-left transition-colors">
                <span className="block font-bold text-white mb-1">Custom Bass</span>
                <span className="block text-xs text-[var(--text-muted)]">Build your perfect bass configuration</span>
              </button>
            </div>
            <button type="button" onClick={() => setShowSelectInstrumentModal(false)} className="mt-6 w-full py-3 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {buildToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[var(--surface-dark)] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm relative shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Delete Build
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Are you sure you want to permanently delete this build? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBuildToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-bold text-sm shadow-[0_0_10px_rgba(239,68,68,0.3)]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Summary Modal */}
      {viewingBuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-4xl max-h-full overflow-y-auto relative shadow-2xl">
            <button type="button" onClick={() => setViewingBuild(null)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors">
              <XCircle className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">{viewingBuild.name || 'Custom Build'} Summary</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Saved on {new Date(viewingBuild.savedAt || new Date()).toLocaleDateString()}</p>

            {getBuildLockState(viewingBuild).isLocked && (
              <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <span>This build is already part of an active order, so its specs and checkout are now locked. You can still review the summary and track project progress here.</span>
              </div>
            )}

            <div className="bg-[var(--bg-primary)] rounded-xl p-5 border border-[var(--border)] mb-6">
              <h3 className="text-lg font-bold text-white mb-4 border-b border-[var(--border)] pb-2 flex justify-between">
                <span>Configuration Breakdown</span>
                <span className="text-[var(--gold-primary)]">₱{(viewingBuild.price || 0).toLocaleString('en-PH')}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {viewingBuild.pricingBreakdown ? Object.entries(viewingBuild.pricingBreakdown).map(([key, price]) => {
                  const label = key === 'base' ? 'Base Model' : viewingBuild.summary?.[key] || viewingBuild.config?.[key];
                  if (!label && price === 0) return null;
                  return (
                    <div key={key} className="flex justify-between items-center text-sm pb-2 border-b border-[var(--border)]">
                      <div className="truncate pr-4">
                        <span className="block text-xs text-[var(--text-muted)] capitalize mb-0.5">{key.replace(/([A-Z])/g, ' ').trim()}</span>
                        <span className="block font-medium text-white truncate">{label}</span>
                      </div>
                      {price > 0 && (
                        <span className="text-gray-300 shrink-0 font-mono text-right">₱{price.toLocaleString('en-PH')}</span>
                      )}
                    </div>
                  )
                }) : (
                  <>
                    <div className="flex justify-between items-center text-sm pb-2 border-b border-[var(--border)]">
                      <div className="truncate pr-4">
                        <span className="block text-xs text-[var(--text-muted)] capitalize mb-0.5">Base Model</span>
                        <span className="block font-medium text-white truncate">Standard Build</span>
                      </div>
                      <span className="text-gray-300 shrink-0 font-mono text-right">₱{BASE_PRICE.toLocaleString('en-PH')}</span>
                    </div>
                    {Object.entries(viewingBuild.config || {}).map(([key, val]) => {
                      if (!val || typeof val !== 'string') return null;
                      const { price, label } = getOldConfigData(key, val, viewingBuild.config?.body);
                      return (
                        <div key={key} className="flex justify-between items-center text-sm pb-2 border-b border-[var(--border)]">
                          <div className="truncate pr-4">
                            <span className="block text-xs text-[var(--text-muted)] capitalize mb-0.5">{key.replace(/([A-Z])/g, ' ').trim()}</span>
                            <span className="block font-medium text-white truncate">{label}</span>
                          </div>
                          {price > 0 && (
                            <span className="text-gray-300 shrink-0 font-mono text-right">₱{price.toLocaleString('en-PH')}</span>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            {viewingBuild.additionalParts && viewingBuild.additionalParts.length > 0 && (
              <div className="bg-[var(--bg-primary)] rounded-xl p-5 border border-[var(--border)] mb-6">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-[var(--border)] pb-2 flex justify-between">
                  <span>Additional Parts</span>
                  <span className="text-[var(--gold-primary)]">₱{viewingBuild.additionalParts.reduce((sum, p) => sum + (p.price * p.quantity), 0).toLocaleString('en-PH')}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {viewingBuild.additionalParts.map((part, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm pb-3 border-b border-[var(--border)] gap-2">
                      <div className="flex-1 truncate">
                        <span className="text-white block font-medium truncate mb-1.5">{part.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-md px-1.5 py-0.5 w-fit">
                            <button type="button" disabled={getBuildLockState(viewingBuild).isLocked} onClick={() => updateAdditionalPartQuantity(viewingBuild.id, idx, part.quantity - 1)} className={`p-0.5 rounded transition-colors ${getBuildLockState(viewingBuild).isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}><Minus className="w-3.5 h-3.5 text-white" /></button>
                            <span className="text-[var(--text-muted)] text-xs w-4 text-center">{part.quantity}</span>
                            <button type="button" disabled={getBuildLockState(viewingBuild).isLocked} onClick={() => updateAdditionalPartQuantity(viewingBuild.id, idx, part.quantity + 1)} className={`p-0.5 rounded transition-colors ${getBuildLockState(viewingBuild).isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}`}><Plus className="w-3.5 h-3.5 text-white" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center sm:block sm:text-right shrink-0">
                        <span className="text-gray-300 font-mono text-sm">₱{(part.price * part.quantity).toLocaleString('en-PH')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-[var(--border)] pt-6 mt-4">
              <span className="text-lg text-[var(--text-muted)]">Grand Total</span>
              <span className="text-3xl font-bold text-[var(--gold-primary)]">
                ₱{(Number(viewingBuild.price) + (viewingBuild.additionalParts || []).reduce((sum, p) => sum + (p.price * p.quantity), 0)).toLocaleString('en-PH')}
              </span>
            </div>

            {getBuildLockState(viewingBuild).isLocked ? (
              getBuildLockState(viewingBuild).project ? (
                <button
                  type="button"
                  onClick={() => {
                    const linkedProject = getBuildLockState(viewingBuild).project
                    setViewingBuild(null);
                    setActiveProjectView(linkedProject);
                  }}
                  className="w-full mt-8 py-4 px-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-lg shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-3"
                >
                  <ShoppingCart className="w-6 h-6" />
                  Buy Now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLockedBuildAction}
                  className="w-full mt-8 py-4 px-4 rounded-xl border border-[var(--border)] text-[var(--text-muted)] font-bold text-lg transition-all flex items-center justify-center gap-3"
                >
                  <Clock className="w-6 h-6" />
                  Already Ordered
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setViewingBuild(null);
                  navigate('/checkout', { state: { checkoutItem: viewingBuild, isCustomBuild: true } });
                }}
                className="w-full mt-8 py-4 px-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-lg shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-3"
              >
                <ShoppingCart className="w-6 h-6" />
                Order This Build
              </button>
            )}
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {isRefundModalOpen && refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-2xl max-h-full overflow-y-auto relative shadow-2xl">
            <button type="button" onClick={() => closeRefundModal()} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-1">Request Refund</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Order #{refundTarget.order_number}</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Select Items to Refund</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {(refundTarget.items || []).map((item, idx) => {
                    const selectableIdx = refundSelectedItems.findIndex(ri => ri.order_item_id === item.order_item_id)
                    if (selectableIdx === -1) return null
                    const selectable = refundSelectedItems[selectableIdx]
                    return (
                      <div key={item.order_item_id || idx} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${selectable.selected ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10' : 'border-[var(--border)] bg-[var(--bg-primary)]'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <button type="button" onClick={() => toggleRefundItem(selectableIdx)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${selectable.selected ? 'bg-[var(--gold-primary)] border-[var(--gold-primary)]' : 'border-[var(--border)]'}`}>
                            {selectable.selected && <Check className="w-3 h-3 text-black" />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{item.product_name || 'Product'}</p>
                            <p className="text-xs text-[var(--text-muted)]">Qty: {selectable.quantity} • PHP {Number(item.unit_price || 0).toLocaleString('en-PH')}</p>
                          </div>
                        </div>
                        {selectable.selected && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => updateRefundQuantity(selectableIdx, selectable.refundQuantity - 1)} className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center hover:bg-white/10"><Minus className="w-3 h-3 text-white" /></button>
                            <span className="text-sm text-white w-6 text-center">{selectable.refundQuantity}</span>
                            <button type="button" onClick={() => updateRefundQuantity(selectableIdx, selectable.refundQuantity + 1)} className="w-6 h-6 rounded border border-[var(--border)] flex items-center justify-center hover:bg-white/10"><Plus className="w-3 h-3 text-white" /></button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Reason for Refund</label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] mb-2"
                >
                  <option value="">Select a reason</option>
                  <option value="damaged">Damaged / Defective item</option>
                  <option value="wrong_item">Wrong item received</option>
                  <option value="not_as_described">Not as described</option>
                  <option value="no_longer_needed">No longer needed</option>
                  <option value="better_price">Found better price elsewhere</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  value={refundCustomerNotes}
                  onChange={(e) => setRefundCustomerNotes(e.target.value)}
                  placeholder="Additional details (optional)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Proof Photos (max 5)</label>
                <div className="flex flex-wrap gap-3 mb-3">
                  {refundImages.map((url, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)]">
                      <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeRefundImage(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {refundImages.length < 5 && (
                    <label className="w-20 h-20 rounded-lg border border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--gold-primary)] transition-colors">
                      <Upload className="w-5 h-5 text-[var(--text-muted)]" />
                      <span className="text-[10px] text-[var(--text-muted)] mt-1">Add</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleRefundImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">JPG, PNG, or WebP. Max 5MB each.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => closeRefundModal()} disabled={isSubmittingRefund} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmitRefund} disabled={isSubmittingRefund} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50">
                  {isSubmittingRefund ? 'Submitting...' : 'Submit Refund Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 sm:p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button
              type="button"
              onClick={() => setReviewModal(null)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <Star className="w-5 h-5 text-[var(--gold-primary)]" />
              <h2 className="text-xl font-bold text-white">
                {reviewModal.mode === 'view'
                  ? 'Product Review'
                  : reviewModal.mode === 'edit'
                    ? 'Edit Product Review'
                    : 'Rate Product'}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-5 truncate">
              {reviewModal.item?.product_name || 'Product'} • Order #{reviewModal.order?.order_number}
            </p>

            {reviewModal.mode === 'view' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DashboardStarRatingDisplay rating={reviewModal.review?.rating || 5} size="w-5 h-5" />
                  <span className="text-sm font-bold text-[var(--gold-primary)]">
                    {reviewModal.review?.rating || 5} / 5
                  </span>
                </div>

                {reviewModal.review?.title && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Title</p>
                    <p className="text-sm font-semibold text-white">{reviewModal.review.title}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Comment</p>
                  <div className="text-sm text-zinc-300 whitespace-pre-line bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border)]">
                    {reviewModal.review?.comment || 'No comment provided.'}
                  </div>
                </div>

                {Array.isArray(reviewModal.review?.images) && reviewModal.review.images.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Photos</p>
                    <div className="flex flex-wrap gap-2.5">
                      {reviewModal.review.images.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] group block"
                        >
                          <img src={url} alt={`Review photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setReviewModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewForm({
                        rating: reviewModal.review?.rating || 5,
                        title: reviewModal.review?.title || '',
                        comment: reviewModal.review?.comment || '',
                        images: Array.isArray(reviewModal.review?.images) ? reviewModal.review.images : [],
                      })
                      setReviewModal(prev => ({ ...prev, mode: 'edit' }))
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Review
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitProductReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Rating *
                  </label>
                  <DashboardStarPicker
                    rating={reviewForm.rating}
                    onChange={r => setReviewForm(prev => ({ ...prev, rating: r }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={e => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Summarize your review or highlight key details"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Review Comment *
                  </label>
                  <textarea
                    rows={4}
                    value={reviewForm.comment}
                    onChange={e => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="What did you like or dislike about this product? How is the sound, feel, and quality?"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Photos (Optional, max 5)
                  </label>
                  <div className="flex flex-wrap gap-2.5 mb-2">
                    {reviewForm.images.map((url, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                        <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReviewImage(idx, 'product')}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {reviewForm.images.length < 5 && (
                      <label className="w-16 h-16 rounded-lg border border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--gold-primary)] transition-colors">
                        {uploadingReviewImage ? (
                          <Loader2 className="w-4 h-4 text-[var(--gold-primary)] animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={uploadingReviewImage}
                          onChange={e => handleReviewImageUpload(e, 'product')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">JPG, PNG, or WebP. Max 5MB each.</p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setReviewModal(null)}
                    disabled={isSubmittingReview}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview || uploadingReviewImage}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingReview ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : reviewModal.mode === 'edit' ? (
                      'Update Review'
                    ) : (
                      'Submit Review'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Customization Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-8">
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6 sm:p-7 w-full max-w-xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button
              type="button"
              onClick={() => setFeedbackModal(null)}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <MessageSquare className="w-5 h-5 text-[var(--gold-primary)]" />
              <h2 className="text-xl font-bold text-white">
                {feedbackModal.mode === 'view'
                  ? 'Customization Feedback'
                  : feedbackModal.mode === 'edit'
                    ? 'Edit Customization Feedback'
                    : 'Customization Feedback'}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              Order #{feedbackModal.order?.order_number} • Custom Instrument Build
            </p>

            {feedbackModal.mode === 'view' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Overall Experience', key: 'overall_rating' },
                    { label: 'Build Quality', key: 'build_quality_rating' },
                    { label: 'Communication', key: 'communication_rating' },
                    { label: 'Design Accuracy', key: 'accuracy_rating' },
                  ].map(dim => (
                    <div key={dim.key} className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">{dim.label}</p>
                      <div className="flex items-center gap-2">
                        <DashboardStarRatingDisplay rating={feedbackModal.feedback?.[dim.key] || 5} size="w-3.5 h-3.5" />
                        <span className="text-xs font-bold text-[var(--gold-primary)]">
                          {feedbackModal.feedback?.[dim.key] || 5} / 5
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Feedback Comments</p>
                  <div className="text-sm text-zinc-300 whitespace-pre-line bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border)]">
                    {feedbackModal.feedback?.comment || 'No comment provided.'}
                  </div>
                </div>

                {Array.isArray(feedbackModal.feedback?.images) && feedbackModal.feedback.images.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Photos</p>
                    <div className="flex flex-wrap gap-2.5">
                      {feedbackModal.feedback.images.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] group block"
                        >
                          <img src={url} alt={`Feedback photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setFeedbackModal(null)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fb = feedbackModal.feedback
                      setFeedbackForm({
                        overall_rating: fb?.overall_rating || 5,
                        build_quality_rating: fb?.build_quality_rating || 5,
                        communication_rating: fb?.communication_rating || 5,
                        accuracy_rating: fb?.accuracy_rating || 5,
                        comment: fb?.comment || '',
                        images: Array.isArray(fb?.images) ? fb.images : [],
                      })
                      setFeedbackModal(prev => ({ ...prev, mode: 'edit' }))
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Feedback
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitCustomFeedback} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      1. Overall Experience *
                    </label>
                    <DashboardStarPicker
                      rating={feedbackForm.overall_rating}
                      onChange={r => setFeedbackForm(prev => ({ ...prev, overall_rating: r }))}
                      size="w-6 h-6"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      2. Build Quality & Craftsmanship *
                    </label>
                    <DashboardStarPicker
                      rating={feedbackForm.build_quality_rating}
                      onChange={r => setFeedbackForm(prev => ({ ...prev, build_quality_rating: r }))}
                      size="w-6 h-6"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      3. Communication & Progress Updates *
                    </label>
                    <DashboardStarPicker
                      rating={feedbackForm.communication_rating}
                      onChange={r => setFeedbackForm(prev => ({ ...prev, communication_rating: r }))}
                      size="w-6 h-6"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      4. Accuracy to Custom Design *
                    </label>
                    <DashboardStarPicker
                      rating={feedbackForm.accuracy_rating}
                      onChange={r => setFeedbackForm(prev => ({ ...prev, accuracy_rating: r }))}
                      size="w-6 h-6"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Feedback Comments *
                  </label>
                  <textarea
                    rows={4}
                    value={feedbackForm.comment}
                    onChange={e => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Tell us about the craftsmanship, tone, feel, or your overall collaboration with our luthiers..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Photos of your build (Optional, max 5)
                  </label>
                  <div className="flex flex-wrap gap-2.5 mb-2">
                    {feedbackForm.images.map((url, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]">
                        <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReviewImage(idx, 'feedback')}
                          className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {feedbackForm.images.length < 5 && (
                      <label className="w-16 h-16 rounded-lg border border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--gold-primary)] transition-colors">
                        {uploadingReviewImage ? (
                          <Loader2 className="w-4 h-4 text-[var(--gold-primary)] animate-spin" />
                        ) : (
                          <>
                            <Camera className="w-4 h-4 text-[var(--text-muted)]" />
                            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={uploadingReviewImage}
                          onChange={e => handleReviewImageUpload(e, 'feedback')}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">JPG, PNG, or WebP. Max 5MB each.</p>
                </div>

                <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setFeedbackModal(null)}
                    disabled={isSubmittingReview}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-white hover:bg-white/5 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview || uploadingReviewImage}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmittingReview ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : feedbackModal.mode === 'edit' ? (
                      'Update Feedback'
                    ) : (
                      'Submit Feedback'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardPage
