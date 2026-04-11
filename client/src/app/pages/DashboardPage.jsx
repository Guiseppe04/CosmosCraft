import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { User, CreditCard, MapPin, Lock, Settings, Bell, Package, Calendar, ChevronRight, Upload, Save, Wallet, ShoppingBag, ShoppingCart, Trash2, Minus, Plus, MessageSquare, Send, Guitar, Clock, Truck, CheckCircle, XCircle, Briefcase, Activity } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { BASE_PRICE, BODY_OPTIONS, BODY_WOOD_OPTIONS, BODY_FINISH_OPTIONS, NECK_OPTIONS, FRETBOARD_OPTIONS, HEADSTOCK_OPTIONS, HEADSTOCK_WOOD_OPTIONS, INLAY_OPTIONS, BRIDGE_OPTIONS, PICKGUARD_OPTIONS_BY_BODY, KNOB_OPTIONS_BY_BODY, HARDWARE_OPTIONS, PICKUP_OPTIONS } from '../lib/guitarBuilderData.js'
import { adminApi } from '../utils/adminApi.js'
import ProjectTaskTracker from '../components/projects/ProjectTaskTracker.jsx'

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

function NotificationRow({ setting }) {
  const [enabled, setEnabled] = useState(setting.defaultOn)

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-dark)] hover:border-[var(--gold-primary)] transition-all duration-200">
      <div>
        <p className="text-sm font-semibold text-white">{setting.title}</p>
        <p className="text-xs text-[var(--text-muted)]">{setting.desc}</p>
      </div>
      <button
        type="button"
        onClick={() => setEnabled(prev => !prev)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          enabled ? 'bg-[var(--gold-primary)]' : 'bg-[var(--border)]'
        }`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useAuth()
  const { cart, addToCart, removeFromCart, updateQuantity, getTotalPrice, getCartCount } = useCart()
  const initialSection = location.state?.section || 'profile'
  const [activeSection, setActiveSection] = useState(initialSection)
  const [profileImage, setProfileImage] = useState('https://i.pravatar.cc/150?img=68')
  const [showSelectInstrumentModal, setShowSelectInstrumentModal] = useState(false)
  const [viewingBuild, setViewingBuild] = useState(null)
  const [toastMessage, setToastMessage] = useState(location.state?.message || null)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [buildToDelete, setBuildToDelete] = useState(null)
  
  const [myProjects, setMyProjects] = useState([])
  const [activeProjectView, setActiveProjectView] = useState(null)

  useEffect(() => {
    if (activeSection === 'projects' && !activeProjectView) {
      fetchMyProjects()
    }
  }, [activeSection, activeProjectView])

  const fetchMyProjects = () => {
    adminApi.getMyProjects().then(res => setMyProjects(res.data)).catch(console.error)
  }

  const handleCancelProject = async (projectId) => {
    if (!window.confirm("Are you sure you want to cancel this project? This will stop the building progress.")) return;
    try {
      await adminApi.updateProject(projectId, { status: 'Cancelled' });
      setToastMessage('Project has been cancelled.');
      fetchMyProjects();
    } catch (err) {
      alert("Failed to cancel project: " + err.message);
    }
  };

  const confirmDelete = () => {
    if (!buildToDelete) return;
    for (const storageKey of ['cosmoscraft_saved_builds', 'cosmoscraft_saved_bass_builds']) {
      const builds = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      const filtered = builds.filter(b => b.id !== buildToDelete);
      if (builds.length !== filtered.length) {
        window.localStorage.setItem(storageKey, JSON.stringify(filtered));
        if (window.localStorage.getItem('cosmoscraft_target_build_id') === buildToDelete) {
          window.localStorage.removeItem('cosmoscraft_target_build_id');
        }
        setRefreshCounter(prev => prev + 1);
        setToastMessage('Build deleted successfully');
        break;
      }
    }
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
    name: '',
    email: '',
    phone: '',
    gender: 'male',
    dobDay: '15',
    dobMonth: 'June',
    dobYear: '1990',
  })

  // Initialize profile data from authenticated user
  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.email || '',
        name: user.name
          ? `${user.name.firstName || ''} ${user.name.lastName || ''}`.trim()
          : '',
        email: user.email || '',
        phone: user.phone || '',
        gender: 'male',
        dobDay: '15',
        dobMonth: 'June',
        dobYear: '1990',
      })
    }
  }, [user])

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

  const menuItems = [
    { id: 'profile', label: 'Profile', icon: User, group: 'account' },
    { id: 'addresses', label: 'Addresses', icon: MapPin, group: 'account' },
    { id: 'password', label: 'Change Password', icon: Lock, group: 'account' },
    { id: 'privacy', label: 'Privacy Settings', icon: Settings, group: 'account' },
    { id: 'notifications', label: 'Notification Settings', icon: Bell, group: 'account' },
    { id: 'my-guitar', label: 'My Guitar', icon: Guitar, group: 'orders' },
    { id: 'projects', label: 'Build Projects', icon: Briefcase, group: 'orders' },
    { id: 'appointments', label: 'My Appointments', icon: Calendar, group: 'orders' },
    { id: 'cart', label: 'My Cart', icon: ShoppingBag, group: 'orders' },
    { id: 'purchases', label: 'My Purchase', icon: Package, group: 'orders' },
    { id: 'logout', label: 'Logout', icon: User, group: 'orders' },
  ]



  const renderPurchasesContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
      <h2 className="text-2xl font-bold text-white mb-1">My Purchase</h2>
      <p className="text-sm text-[var(--text-muted)] mb-8">Track and manage your orders</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 text-sm font-medium border-b border-[var(--border)] pb-3 mb-10">
        {['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Refund'].map(label => (
          <button
            key={label}
            className={`pb-2 transition-colors duration-200 ${
              label === 'All'
                ? 'border-b-2 border-[var(--gold-primary)] text-[var(--gold-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-white'
            }`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

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
    </div>
  )

  const renderAppointmentsContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
      <h2 className="text-2xl font-bold text-white mb-1">My Appointments</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">View and manage your service appointments</p>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
        </div>
        <p className="text-white font-medium mb-1">No appointments yet</p>
        <p className="text-sm text-[var(--text-muted)] mb-6">Book a service appointment to see it here</p>
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition"
        >
          Book Appointment
        </button>
      </div>
    </div>
  )

  const renderProjectsContent = () => {
    if (activeProjectView) {
      return (
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
          <button onClick={() => setActiveProjectView(null)} className="mb-6 text-[var(--gold-primary)] hover:underline flex items-center gap-2 text-sm font-semibold">
            ← Back to Build Projects
          </button>
          <ProjectTaskTracker projectId={activeProjectView.project_id} isAdmin={false} />
        </div>
      );
    }

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
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
            {myProjects.map((project) => (
              <div key={project.project_id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">{project.name}</h3>
                    <p className="text-[var(--text-muted)] text-sm mt-1">{project.description || 'Custom Build Project'}</p>
                    <div className="mt-4 flex items-center gap-4">
                      <span className="px-2 py-0.5 border border-[var(--border)] rounded-full text-xs font-semibold text-white">{project.status}</span>
                      <span className="text-[var(--gold-primary)] font-bold text-sm">{project.progress}% Complete</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveProjectView(project)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all flex items-center gap-2"
                  >
                    <Activity className="w-4 h-4" /> Track Progress
                  </button>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                  {project.progress < 80 && project.status !== 'Cancelled' && (
                    <button
                      onClick={() => handleCancelProject(project.project_id)}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors text-sm font-semibold"
                    >
                      Cancel Project
                    </button>
                  )}
                  {project.progress < 80 && project.status !== 'Cancelled' && (
                    <button
                      onClick={() => {
                          // Edit specs logic
                          alert("Inline Edit Specs coming soon");
                      }}
                      className="px-4 py-2 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm font-semibold"
                    >
                      Edit Project
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMyGuitarContent = () => {
    const savedGuitarBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_builds') || '[]').map(b => ({...b, isBass: false}))
    const savedBassBuilds = JSON.parse(window.localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').map(b => ({...b, isBass: true}))
    const allBuilds = [...savedGuitarBuilds, ...savedBassBuilds].sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))

    const deleteBuild = (buildId) => {
      setBuildToDelete(buildId);
    };

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">My Saved Builds</h2>
            <p className="text-sm text-[var(--text-muted)]">Manage your custom guitar and bass designs</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSelectInstrumentModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold text-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all flex items-center gap-2"
            >
              <Guitar className="w-4 h-4" />
              Create New
            </button>
          </div>
        </div>

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

              return (
              <div key={build.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--gold-primary)]/40 transition-colors flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{build.name || 'Custom Build'}</h3>
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

                <div className="mt-6 space-y-2">
                   <div className="flex gap-2">
                      <button
                        onClick={() => {
                          window.localStorage.setItem('cosmoscraft_target_build_id', build.id);
                          navigate('/shop');
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg border border-[var(--border)] text-[var(--text-light)] text-xs hover:bg-white/5 transition-all text-center font-medium"
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
                        onClick={() => navigate(build.isBass ? `/customize-bass?edit=${build.id}` : `/customize?edit=${build.id}`)}
                        className="flex-1 py-1.5 px-2 rounded-lg border border-blue-500/30 text-blue-400 text-xs hover:bg-blue-500/10 transition-all text-center font-medium"
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
                  <button
                    onClick={() => {
                        navigate('/checkout', { state: { checkoutItem: build, isCustomBuild: true } });
                    }}
                    className="w-full mt-2 py-2.5 px-3 rounded-lg bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] hover:shadow-[0_0_15px_rgba(212,175,55,0.5)] transition-all flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Order This Build
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    )
  }

  const renderCartContent = () => {
    const cartTotal = getTotalPrice()
    const cartCount = getCartCount()

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
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

  const renderProfileContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
      <h2 className="text-2xl font-bold text-white mb-1">My Profile</h2>
      <p className="text-sm text-[var(--text-muted)] mb-10">Manage and protect your account</p>

      <div className="flex items-center gap-6 mb-10 pb-8 border-b border-[var(--border)]">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--bg-primary)] border-2 border-[var(--gold-primary)]">
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">{profileData.username}</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Edit Profile
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Username</label>
          <input
            type="text"
            value={profileData.username}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] bg-[var(--bg-primary)]"
          />
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Username can only be changed once.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Full Name</label>
          <input
            type="text"
            value={profileData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Email</label>
          <input
            type="email"
            value={profileData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Phone Number</label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={e => handleInputChange('phone', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Gender</label>
          <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
            {['male', 'female', 'other'].map(value => (
              <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                <span
                  className={`w-4 h-4 rounded-full border-2 ${
                    profileData.gender === value ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]' : 'border-[var(--border)]'
                  } flex items-center justify-center`}
                >
                  {profileData.gender === value && <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dark)]" />}
                </span>
                <span className="capitalize">{value}</span>
                <input
                  type="radio"
                  className="hidden"
                  checked={profileData.gender === value}
                  onChange={() => handleInputChange('gender', value)}
                />
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">Date of birth</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={profileData.dobDay}
              onChange={e => handleInputChange('dobDay', e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            >
              {Array.from({ length: 31 }).map((_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              value={profileData.dobMonth}
              onChange={e => handleInputChange('dobMonth', e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            >
              {[
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December',
              ].map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={profileData.dobYear}
              onChange={e => handleInputChange('dobYear', e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            >
              {Array.from({ length: 70 }).map((_, i) => {
                const year = 2005 - i
                return (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition"
      >
        <Save className="w-4 h-4" />
        Save Changes
      </button>
    </div>
  )

  const renderPlaceholderSection = (title, description) => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8 text-center">
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  )

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-0">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[var(--surface-dark)] border-r-2 border-white/30 rounded-l-2xl overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-white/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-primary)] border-2 border-white flex-shrink-0">
                <img src={profileImage} alt="User" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {profileData.username}
                </p>
                <button
                  type="button"
                  className="text-xs text-white/70 hover:text-white inline-flex items-center gap-1 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="px-3 py-4 space-y-6 text-sm">
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
                      const isLogout = item.id === 'logout'
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isLogout) {
                              logout()
                              navigate('/')
                            } else {
                              setActiveSection(item.id)
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                            isLogout
                              ? 'text-red-400 hover:bg-red-500/10 border-2 border-transparent'
                              : active
                                ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-medium border-2 border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                                : 'text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-white border-2 border-transparent'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isLogout ? 'text-red-400' : ''}`} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {!isLogout && <ChevronRight className="w-3.5 h-3.5" />}
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
            className="space-y-4"
          >
            {activeSection === 'profile' && renderProfileContent()}
            {activeSection === 'my-guitar' && renderMyGuitarContent()}
            {activeSection === 'projects' && renderProjectsContent()}
            {activeSection === 'appointments' && renderAppointmentsContent()}
            {activeSection === 'cart' && renderCartContent()}
            {activeSection === 'purchases' && renderPurchasesContent()}

            {activeSection === 'addresses' &&
              renderPlaceholderSection(
                'Addresses',
                'Save your shipping and billing addresses to checkout faster.',
              )}
            {activeSection === 'password' && (
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-white mb-1">Change Password</h2>
                <p className="text-sm text-[var(--text-muted)] mb-10">
                  Update your password regularly for security
                </p>
                <div className="space-y-5 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm text-white bg-[var(--bg-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition"
                >
                  Update Password
                </button>
              </div>
            )}
            {activeSection === 'privacy' &&
              renderPlaceholderSection('Privacy Settings', 'Control your privacy and security preferences.')}
            {activeSection === 'notifications' && (
              <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
                <h2 className="text-2xl font-bold text-white mb-1">Notification Settings</h2>
                <p className="text-sm text-[var(--text-muted)] mb-8">Manage how you receive notifications</p>
                <div className="space-y-4">
                  <NotificationRow
                    setting={{
                      title: 'Email Notifications',
                      desc: 'Receive updates about your orders via email',
                      defaultOn: true,
                    }}
                  />
                  <NotificationRow
                    setting={{
                      title: 'SMS Notifications',
                      desc: 'Receive text messages for order updates',
                      defaultOn: false,
                    }}
                  />
                  <NotificationRow
                    setting={{
                      title: 'Push Notifications',
                      desc: 'Get real-time alerts on your device',
                      defaultOn: true,
                    }}
                  />
                  <NotificationRow
                    setting={{
                      title: 'Marketing Emails',
                      desc: 'Receive promotional offers and updates',
                      defaultOn: false,
                    }}
                  />
                </div>
              </div>
            )}
          </motion.main>
        </div>
      </div>

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
                           <span className="block text-xs text-[var(--text-muted)] capitalize mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
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
                               <span className="block text-xs text-[var(--text-muted)] capitalize mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
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
                            <button onClick={() => updateAdditionalPartQuantity(viewingBuild.id, idx, part.quantity - 1)} className="p-0.5 hover:bg-white/10 rounded cursor-pointer transition-colors"><Minus className="w-3.5 h-3.5 text-white" /></button>
                            <span className="text-[var(--text-muted)] text-xs w-4 text-center">{part.quantity}</span>
                            <button onClick={() => updateAdditionalPartQuantity(viewingBuild.id, idx, part.quantity + 1)} className="p-0.5 hover:bg-white/10 rounded cursor-pointer transition-colors"><Plus className="w-3.5 h-3.5 text-white" /></button>
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
          </div>
        </div>
      )}

    </div>
  )
}

export default DashboardPage
