import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { User, CreditCard, MapPin, Lock, Package, Calendar, ChevronRight, Upload, Save, Wallet, ShoppingBag, ShoppingCart, Trash2, Minus, Plus, MessageSquare, Send, Guitar, Clock, Truck, CheckCircle, XCircle, Briefcase, Activity, Star, Loader2, Edit, AlertCircle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { BASE_PRICE, BODY_OPTIONS, BODY_WOOD_OPTIONS, BODY_FINISH_OPTIONS, NECK_OPTIONS, FRETBOARD_OPTIONS, HEADSTOCK_OPTIONS, HEADSTOCK_WOOD_OPTIONS, INLAY_OPTIONS, BRIDGE_OPTIONS, PICKGUARD_OPTIONS_BY_BODY, KNOB_OPTIONS_BY_BODY, HARDWARE_OPTIONS, PICKUP_OPTIONS } from '../lib/guitarBuilderData.js'
import { adminApi } from '../utils/adminApi.js'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker.jsx'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import { Country } from 'country-state-city'
import { ConfirmModal } from '../components/ui/ConfirmModal'

const ALL_COUNTRIES = Country.getAllCountries()
const PHILIPPINES = ALL_COUNTRIES.find(c => c.isoCode === 'PH')
const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => c.isoCode !== 'PH')
const COUNTRIES = PHILIPPINES ? [PHILIPPINES, ...OTHER_COUNTRIES] : ALL_COUNTRIES
const MAX_USER_ADDRESSES = 2
const MAX_SAVED_GUITAR_BUILDS = 10
const ORDER_CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Need to change shipping details',
  'Found a better price elsewhere',
  'Payment issue',
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

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user, updateUser } = useAuth()
  const { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, getCartCount } = useCart()
  const initialSection = location.state?.section || 'profile'
  const VALID_SECTIONS = new Set(['profile', 'my-guitar', 'appointments', 'cart', 'purchases', 'addresses', 'password'])
  const [activeSection, setActiveSection] = useState(initialSection)
  const [profileImage, setProfileImage] = useState('')
  const [showSelectInstrumentModal, setShowSelectInstrumentModal] = useState(false)
  const [viewingBuild, setViewingBuild] = useState(null)
  const [toastMessage, setToastMessage] = useState(location.state?.message || null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [buildToDelete, setBuildToDelete] = useState(null)
  
  const [myProjects, setMyProjects] = useState([])
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
  const [isCancelProjectModalOpen, setIsCancelProjectModalOpen] = useState(false)
  const [cancelProjectTarget, setCancelProjectTarget] = useState(null)
  const [isCancellingProject, setIsCancellingProject] = useState(false)

  const [myAppointments, setMyAppointments] = useState([])
  const [reschedulingAptId, setReschedulingAptId] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  
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

  const fetchMyProjects = () => {
    adminApi.getMyProjects().then(res => setMyProjects(res.data)).catch(console.error)
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
      const res = await adminApi.getOrder(orderId);
      const items = res.data.order.items;
      if (items && items.length > 0) {
        items.forEach(item => {
          addToCart({
            id: item.product_id || item.product_sku || `prod-${Date.now()}`,
            name: item.product_name || 'Item',
            price: Number(item.unit_price),
            category: 'Shop',
            image: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80',
          }, item.quantity);
        });
        setToastMessage('Items added to cart!');
        navigate('/cart');
      }
    } catch (err) {
      alert("Failed to buy again: " + err.message);
    }
  };

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

  const openCancelProjectModal = (project) => {
    setCancelProjectTarget(project)
    setIsCancelProjectModalOpen(true)
  }

  const closeCancelProjectModal = (force = false) => {
    if (isCancellingProject && !force) return
    setIsCancelProjectModalOpen(false)
    setCancelProjectTarget(null)
  }

  const handleCancelProject = async () => {
    if (!cancelProjectTarget?.project_id) return

    try {
      setIsCancellingProject(true)
      await adminApi.cancelMyProject(cancelProjectTarget.project_id)
      setToastMessage('Project has been cancelled.');
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
    } catch(err) {
      alert("Failed to reschedule: " + err.message);
    }
  };

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
    birthDate: '',
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
    category: 'Home',
    country: 'PH',
    streetLine1: '',
    streetLine2: '',
    province: '',
    city: '',
    barangay: '',
    postalZipCode: '',
    isDefault: true
  })
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)

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
            birthDate: u.birthDate ? String(u.birthDate).split('T')[0] : '',
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
      if (activePurchaseTab === 'To Receive' && order.status === 'shipped') return true;
      if (activePurchaseTab === 'Completed' && (order.status === 'delivered' || order.status === 'completed')) return true;
      if (activePurchaseTab === 'Cancelled' && order.status === 'cancelled') return true;
      if (activePurchaseTab === 'Refund' && order.status === 'refunded') return true;
      return false;
    });

    return (
      <div className="space-y-8">
        {/* {renderProjectsContent()} */}

        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <h2 className="text-2xl font-bold text-white mb-1">My Purchase</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8">Track and manage your orders</p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-4 text-sm font-medium border-b border-[var(--border)] pb-3 mb-10 overflow-x-auto">
          {['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Refund'].map(label => (
            <button
              key={label}
              onClick={() => setActivePurchaseTab(label)}
              className={`pb-2 transition-colors duration-200 whitespace-nowrap ${
                label === activePurchaseTab
                  ? 'border-b-2 border-[var(--gold-primary)] text-[var(--gold-primary)]'
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
            <p className="text-white font-medium mb-1">No orders found</p>
            <p className="text-sm text-[var(--text-muted)]">
              You don't have any orders with this status.
            </p>
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
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize border ${
                         ['approved', 'paid', 'verified'].includes(String(order.payment_status || '').toLowerCase())
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

                        return (
                          <div key={item.order_item_id || `${order.order_id}-${index}`} className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{itemName}</p>
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                Qty: {quantity}{item.customization_id ? ' • Custom Build' : ''}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-white whitespace-nowrap">PHP {unitPrice.toLocaleString('en-PH')}</span>
                          </div>
                        )
                      })}
                    </div>
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
                     <span className="text-xl font-bold text-[var(--gold-primary)] block">â‚±{displayTotalAmount.toLocaleString('en-PH')}</span>
                     <span className="text-xl font-bold text-[var(--gold-primary)] block">₱{Number(order.total_amount || 0).toLocaleString('en-PH')}</span>
                   </div>
                </div>
                {order.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end">
                    <button
                      onClick={() => openCancelOrderModal(order)}
                      className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors rounded-lg text-sm font-semibold"
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
                {(order.status === 'delivered' || order.status === 'completed') && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-end gap-3">
                    <button
                      onClick={() => setRatingModalOrderId(order.order_id)}
                      className="px-4 py-2 border border-[var(--border)] text-white hover:bg-white/5 transition-colors rounded-lg text-sm font-semibold flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 text-[var(--gold-primary)]" />
                      Rate Product
                    </button>
                    <button
                      onClick={() => handleBuyAgain(order.order_id)}
                      className="px-4 py-2 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all rounded-lg text-sm font-bold flex items-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Buy Again
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
        </div>
      </div>
    )
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
          {myAppointments.map(apt => {
            const apptDate = apt.scheduled_at || apt.date;
            
            // Check if past current time and not completed/cancelled
            const isPast = apptDate && new Date(apptDate) < new Date();
            const needsReschedule = isPast && apt.status !== 'completed' && apt.status !== 'cancelled';
            const isReschedulingThis = reschedulingAptId === (apt.appointment_id || apt.id);

            return (
              <div key={apt.appointment_id || apt.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">{apt.guitar_details ? `${apt.guitar_details.brand} ${apt.guitar_details.model}` : (apt.title || apt.service_name || 'Appointment')}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 capitalize">
                      {Array.isArray(apt.services) ? apt.services.map(s => s.replace(/-/g, ' ')).join(', ') : (apt.service_name || 'Consultation')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border ${
                    apt.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 
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
                  <div className="grid sm:grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-[var(--border)] relative">
                    <div>
                      <span className="block text-[var(--text-muted)] mb-1">Date & Time</span>
                      <span className="text-white">
                        {apptDate ? new Date(apptDate).toLocaleDateString() : 'â€”'} at {apt.time || (apptDate ? new Date(apptDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'â€”')}
                      </span>
                    </div>
                    {apt.location_id && (
                      <div> 
                        <span className="block text-[var(--text-muted)] mb-1">Branch</span>
                        <span className="text-white capitalize">{apt.location_id}</span>
                      </div>
                    )}
                    {apt.notes && (
                      <div className="sm:col-span-2 mt-2">
                         <span className="block text-[var(--text-muted)] mb-1">Notes</span>
                         <span className="text-white">{apt.notes}</span>
                      </div>
                    )}
                    
                    {needsReschedule && (
                      <div className="sm:col-span-2 mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                         <div className="flex items-center gap-3">
                           <AlertCircle className="w-5 h-5 text-orange-400" />
                           <div>
                             <p className="text-orange-400 font-semibold text-sm">Action Required</p>
                             <p className="text-orange-400/80 text-xs mt-0.5">This appointment is past due. Please reschedule it.</p>
                           </div>
                         </div>
                         <button 
                           onClick={() => {
                             setReschedulingAptId(apt.appointment_id || apt.id);
                             setRescheduleDate(new Date().toISOString().split('T')[0]);
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
      return (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 lg:p-7 xl:p-8">
          <button onClick={() => setActiveProjectView(null)} className="mb-6 text-[var(--gold-primary)] hover:underline flex items-center gap-2 text-sm font-semibold">
            &larr; Back to Build Projects
          </button>
          <ProjectTaskTracker projectId={activeProjectView.project_id} isAdmin={false} />
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
                className={`relative pb-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {tab.label}
                <span
                  className={`absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity ${
                    isActive ? 'opacity-100 bg-[var(--gold-primary)]' : 'opacity-0'
                  }`}
                />
              </button>
            )
          })}
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Build Projects</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8">Track progress on your custom builds and repairs</p>

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
            {myProjects.map((project) => {
              const projectDescription = parseProjectDescription(project.description || 'Custom Build Project')
              return (
              <div key={project.project_id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">{project.name}</h3>
                    {projectDescription?.title ? (
                      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                        <p className="font-semibold text-white">{projectDescription.title}</p>
                        {projectDescription.bulletItems.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {projectDescription.bulletItems.map((item, index) => (
                              <li key={`${project.project_id}-bullet-${index}`} className="flex items-start gap-2">
                                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-[var(--gold-primary)] shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {projectDescription.metaLines.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                            {projectDescription.metaLines.map((line, index) => (
                              <p key={`${project.project_id}-meta-${index}`} className="break-words">
                                {line}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[var(--text-muted)] text-sm mt-1 break-words">{projectDescription?.plainText || 'Custom Build Project'}</p>
                    )}
                    <p className="text-[var(--text-muted)] text-sm mt-2">
                      Estimated completion:{' '}
                      <span className="text-white font-medium">
                        {formatEstimatedCompletionDate(project) || 'Not set'}
                      </span>
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <span className="px-2 py-0.5 border border-[var(--border)] rounded-full text-xs font-semibold text-white">{formatStatus(project.status)}</span>
                      <span className="text-[var(--gold-primary)] font-bold text-sm">{project.progress}% Complete</span>
                    </div>
                  </div>
                  
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                  {project.progress < 80 && String(project.status || '').toLowerCase() !== 'cancelled' && (
                    <button
                      onClick={() => openCancelProjectModal(project)}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors text-sm font-semibold"
                    >
                      Cancel Project
                    </button>
                  )}
                  <button
                    onClick={() => setActiveProjectView(project)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all flex items-center gap-2"
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
            )})}
          </div>
        )}
      </div>
    );
  };

  const renderMyGuitarContent = () => {
    if (activeProjectView) {
      return renderProjectsContent()
    }

    const savedGuitarBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]').map(b => ({...b, isBass: false}))
    const savedBassBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').map(b => ({...b, isBass: true}))
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
                className={`relative pb-3 text-sm sm:text-base font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {tab.label}
                <span
                  className={`absolute left-0 -bottom-px h-0.5 w-full rounded-full transition-opacity ${
                    isActive ? 'opacity-100 bg-[var(--gold-primary)]' : 'opacity-0'
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
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                isBuildLimitReached
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
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[var(--text-light)] text-xs transition-all text-center font-medium ${
                          buildLockState.isLocked
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
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-xs transition-all text-center font-medium ${
                          buildLockState.isLocked
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
            )})}
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

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-5 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">My Cart</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in your cart` : 'Your cart is empty'}
            </p>
          </div>
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
            {cart.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4 p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl hover:border-[var(--gold-primary)]/30 transition-colors"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--surface-dark)]">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white truncate">{item.name}</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.category}</p>
                      <p className="text-lg font-bold text-[var(--gold-primary)] mt-1">
                        ₱{item.price.toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-2 bg-[var(--surface-dark)] rounded-lg border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-white font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm text-[var(--text-muted)]">
                      Subtotal: <span className="text-white font-medium">₱{(item.price * item.quantity).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </motion.div>
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
        birthDate: profileData.birthDate || null,
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

  const handleSaveAddress = async () => {
    try {
      if (!editingAddressId && addresses.length >= MAX_USER_ADDRESSES) {
        alert(`You can only save up to ${MAX_USER_ADDRESSES} addresses.`)
        return
      }

      const provinceLabel = locationData.provinces.find(p => p.psgcCode === addressData.province)?.name || addressData.province
      const cityLabel = locationData.cities.find(c => c.psgcCode === addressData.city)?.name || addressData.city
      
      const addressPayload = {
        label: addressData.category,
        streetLine1: addressData.streetLine1,
        streetLine2: addressData.streetLine2,
        city: cityLabel || addressData.city,
        stateProvince: provinceLabel || addressData.province,
        postalZipCode: addressData.postalZipCode,
        country: addressData.country,
        isDefault: addressData.isDefault,
      }
      if (editingAddressId) {
        await adminApi.updateAddress(editingAddressId, addressPayload)
        setToastMessage('Address updated successfully!')
        setEditingAddressId(null)
      } else {
        await adminApi.addAddress(addressPayload)
        setToastMessage('Address added successfully!')
        setIsAddingAddress(false)
      }
      const res = await adminApi.getProfile()
      if (res?.data?.user?.addresses) {
        setAddresses(res.data.user.addresses)
      }
      setAddressData({ category: 'Home', country: 'PH', streetLine1: '', streetLine2: '', province: '', city: '', barangay: '', postalZipCode: '', isDefault: true })
      setLocationData(prev => ({ ...prev, cities: [], barangays: [] }))
    } catch (err) {
      alert("Failed to save address: " + err.message)
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
    const canAddMoreAddresses = addresses.length < MAX_USER_ADDRESSES

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
        {!isAddingAddress && canAddMoreAddresses && (
          <button
            onClick={() => setIsAddingAddress(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--gold-primary)] text-sm font-semibold text-[var(--gold-primary)] hover:bg-[var(--gold-primary)] hover:text-[var(--text-dark)] transition-colors"
          >
            + Add New Address
          </button>
        )}
      </div>

      {!canAddMoreAddresses && !isAddingAddress && !editingAddressId && (
        <p className="mb-6 text-sm text-[var(--text-muted)]">Maximum of 2 addresses reached.</p>
      )}

      {isAddingAddress || editingAddressId ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); setAddressData({ category: 'Home', country: 'PH', streetLine1: '', streetLine2: '', province: '', city: '', barangay: '', postalZipCode: '', isDefault: true }); setLocationData(prev => ({ ...prev, cities: [], barangays: [] })) }} className="text-[var(--gold-primary)] hover:underline text-sm font-semibold flex items-center gap-1">
              Back
            </button>
            <span className="text-white font-semibold">{editingAddressId ? 'Edit Address' : 'Add New Address'}</span>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Address Category</label>
            <div className="flex gap-2">
              {['Home', 'Work', 'Other'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAddressData(prev => ({ ...prev, category: cat }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                    addressData.category === cat
                      ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Country *</label>
            <select
              value={addressData.country}
              onChange={e => setAddressData(p => ({ ...p, country: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] appearance-none cursor-pointer"
            >
              <option value="" disabled className="bg-[var(--surface-dark)]">Select Country</option>
              {COUNTRIES.map(c => (
                <option key={c.isoCode} value={c.isoCode} className="bg-[var(--surface-dark)]">{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
               <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Street Line 1 *</label>
               <input type="text" value={addressData.streetLine1} onChange={e => setAddressData(p => ({...p, streetLine1: e.target.value}))} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]" />
            </div>
            <div className="col-span-2">
               <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Street Line 2 (Optional)</label>
               <input type="text" value={addressData.streetLine2} onChange={e => setAddressData(p => ({...p, streetLine2: e.target.value}))} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Province</label>
              <select 
                value={addressData.province}
                onChange={(e) => {
                  const opt = locationData.provinces.find(p => p.psgcCode === e.target.value)
                  handleProvinceChange(e.target.value, opt?.name || '')
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
              >
                <option value="" className="bg-[var(--surface-dark)]">Select Province</option>
                {locationData.provinces.map(p => (
                  <option key={p.psgcCode} value={p.psgcCode} className="bg-[var(--surface-dark)]">{p.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">City / Municipality</label>
              <select 
                value={addressData.city}
                onChange={(e) => {
                  const opt = locationData.cities.find(c => c.psgcCode === e.target.value)
                  handleCityChange(e.target.value, opt?.name || '')
                }}
                disabled={!addressData.province}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50"
              >
                <option value="" className="bg-[var(--surface-dark)]">{addressData.province ? 'Select City' : 'Select a province first'}</option>
                {locationData.cities.map(c => (
                  <option key={c.psgcCode} value={c.psgcCode} className="bg-[var(--surface-dark)]">{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Barangay</label>
              <select 
                value={addressData.barangay}
                onChange={e => handleBarangayChange(e.target.value)}
                disabled={!addressData.city}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50"
              >
                <option value="" className="bg-[var(--surface-dark)]">{addressData.city ? 'Select Barangay' : 'Select a city first'}</option>
                {locationData.barangays.map(b => (
                  <option key={b.psgcCode} value={b.name} className="bg-[var(--surface-dark)]">{b.name}</option>
                ))}
              </select>
            </div>
            <div>
               <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Postal / Zip Code</label>
               <input type="text" value={addressData.postalZipCode} onChange={e => setAddressData(p => ({...p, postalZipCode: e.target.value}))} className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]" />
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={handleSaveAddress} className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold shadow-[0_0_15px_rgba(212,175,55,0.3)]">{editingAddressId ? 'Update Address' : 'Save Address'}</button>
            <button onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); setAddressData({ category: 'Home', country: 'PH', streetLine1: '', streetLine2: '', province: '', city: '', barangay: '', postalZipCode: '', isDefault: true }); setLocationData(prev => ({ ...prev, cities: [], barangays: [] })) }} className="px-6 py-2.5 rounded-full border border-[var(--border)] text-white hover:bg-white/5 transition-all">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses && addresses.length > 0 ? (
            addresses.map((addr) => (
              <div key={addr.address_id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white capitalize">
                      {addr.label || 'Address'}
                    </span>
                    {addr.is_default && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--gold-primary)] text-[var(--text-dark)]">Default</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { 
                      setEditingAddressId(addr.address_id)
                      setAddressData({ 
                        category: addr.label || 'Home',
                        country: addr.country || 'PH',
                        streetLine1: addr.street_line1 || '', 
                        streetLine2: addr.street_line2 || '', 
                        province: addr.province || '',
                        city: addr.city || '', 
                        barangay: addr.barangay || '',
                        postalZipCode: addr.postal_code || '', 
                        isDefault: addr.is_default || false 
                      })
                      const loadCascade = async () => {
                        try {
                          const provinces = getAllProvinces()
                          setLocationData(prev => ({ ...prev, provinces }))
                          if (addr.province) {
                            const province = provinces.find(p => p.name === addr.province || p.psgcCode === addr.province)
                            if (province) {
                              const cities = getMunicipalitiesByProvince(province.psgcCode)
                              setLocationData(prev => ({ ...prev, cities }))
                            }
                          }
                          if (addr.city) {
                            const cities = locationData.cities.length > 0 ? locationData.cities : (addr.province ? getMunicipalitiesByProvince(addr.province) : [])
                            const city = cities.find(c => c.name === addr.city || c.psgcCode === addr.city)
                            if (city) {
                              const barangays = getBarangaysByMunicipality(city.psgcCode)
                              setLocationData(prev => ({ ...prev, barangays }))
                            }
                          }
                        } catch (e) {
                          console.error('Failed to load cascade:', e)
                        }
                      }
                      loadCascade()
                    }} className="p-2.5 hover:bg-[var(--gold-primary)]/20 hover:border hover:border-[var(--gold-primary)] rounded-lg transition-all duration-150">
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

  const currentMenu = menuItems.find(item => item.id === activeSection)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24 pb-12">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[100] bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
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
      <ConfirmModal
        open={isCancelProjectModalOpen}
        title="Cancel Project"
        description={cancelProjectTarget?.name
          ? `${cancelProjectTarget.name} will be cancelled and the build will stop where it is now.`
          : 'Are you sure you want to cancel this project? This will stop the building progress.'}
        confirmLabel="Cancel Project"
        cancelLabel="Keep Project"
        variant="danger"
        isBusy={isCancellingProject}
        onConfirm={handleCancelProject}
        onCancel={() => closeCancelProjectModal()}
      />
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
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        isSelected
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            active
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            active
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
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                          active
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
                className={`flex-1 py-2.5 rounded-xl text-[var(--text-dark)] transition-all font-bold text-sm ${
                  rating === 0 
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

    </div>
  )
}

export default DashboardPage


