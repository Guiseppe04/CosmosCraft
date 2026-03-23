import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { User, CreditCard, MapPin, Lock, Settings, Bell, Package, Calendar, ChevronRight, Upload, Save, Wallet, ShoppingBag, Trash2, Minus, Plus, MessageSquare, Send, Guitar } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'

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
  const [newMessage, setNewMessage] = useState('')
  const [selectedConversation, setSelectedConversation] = useState(1)
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'CosmosCraft Support',
      avatar: 'CC',
      content: 'Welcome to CosmosCraft! Your custom guitar order has been received and our luthiers are preparing to begin work.',
      timestamp: '2 hours ago',
      unread: true,
    },
    {
      id: 2,
      sender: 'John Martinez',
      avatar: 'JM',
      content: 'Hi! Just wanted to check on the progress of my guitar. Is everything on schedule?',
      timestamp: '1 day ago',
      unread: false,
    },
    {
      id: 3,
      sender: 'CosmosCraft Team',
      avatar: 'CT',
      content: 'Your guitar has passed the quality check! We will begin the finishing process tomorrow.',
      timestamp: '3 days ago',
      unread: false,
    },
  ])

  // Guitar Build Options State
  const [guitarBuild, setGuitarBuild] = useState({
    bodyStyle: 'strat',
    woodType: 'mahogany',
    neckWood: 'maple',
    fretboard: 'rosewood',
    pickups: 'humbucker',
    bridge: 'fixed',
    finish: 'gloss',
    tuners: 'locking',
    price: 8500,
  })

  const guitarBuildOptions = {
    bodyStyle: [
      { id: 'strat', name: 'Stratocaster', price: 0, image: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=200&q=80' },
      { id: 'tele', name: 'Telecaster', price: 0, image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=200&q=80' },
      { id: 'lespaul', name: 'Les Paul', price: 500, image: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=200&q=80' },
      { id: 'supernova', name: 'Supernova', price: 800, image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=200&q=80' },
    ],
    woodType: [
      { id: 'mahogany', name: 'Mahogany', price: 0 },
      { id: 'alder', name: 'Alder', price: 200 },
      { id: 'ash', name: 'Swamp Ash', price: 350 },
      { id: 'korina', name: 'Korina', price: 600 },
    ],
    neckWood: [
      { id: 'maple', name: 'Maple', price: 0 },
      { id: 'rosewood', name: 'Rosewood', price: 150 },
      { id: 'ebony', name: 'Ebony', price: 300 },
    ],
    fretboard: [
      { id: 'rosewood', name: 'Rosewood', price: 0 },
      { id: 'maple', name: 'Maple', price: 0 },
      { id: 'ebony', name: 'Ebony', price: 100 },
    ],
    pickups: [
      { id: 'single', name: 'Single Coil', price: 0 },
      { id: 'humbucker', name: 'Humbucker', price: 200 },
      { id: 'p90', name: 'P90', price: 150 },
      { id: 'active', name: 'Active Electronics', price: 400 },
    ],
    bridge: [
      { id: 'fixed', name: 'Fixed Bridge', price: 0 },
      { id: 'tune-o-matic', name: 'Tune-O-Matic', price: 150 },
      { id: 'tremolo', name: 'Tremolo', price: 250 },
      { id: 'floyd', name: 'Floyd Rose', price: 450 },
    ],
    finish: [
      { id: 'gloss', name: 'Gloss', price: 0 },
      { id: 'satin', name: 'Satin', price: 100 },
      { id: 'matte', name: 'Matte', price: 150 },
      { id: 'burst', name: 'Sunburst', price: 200 },
    ],
    tuners: [
      { id: 'standard', name: 'Standard', price: 0 },
      { id: 'locking', name: 'Locking', price: 200 },
      { id: 'gotoh', name: 'Gotoh', price: 350 },
    ],
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
    { id: 'payment-methods', label: 'Payment Methods', icon: Wallet, group: 'account' },
    { id: 'addresses', label: 'Addresses', icon: MapPin, group: 'account' },
    { id: 'password', label: 'Change Password', icon: Lock, group: 'account' },
    { id: 'privacy', label: 'Privacy Settings', icon: Settings, group: 'account' },
    { id: 'notifications', label: 'Notification Settings', icon: Bell, group: 'account' },
    { id: 'my-guitar', label: 'My Guitar', icon: Guitar, group: 'orders' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, group: 'orders' },
    { id: 'appointments', label: 'My Appointments', icon: Calendar, group: 'orders' },
    { id: 'cart', label: 'My Cart', icon: ShoppingBag, group: 'orders' },
    { id: 'purchases', label: 'My Purchase', icon: Package, group: 'orders' },
    { id: 'logout', label: 'Logout', icon: User, group: 'orders' },
  ]

  const renderPaymentMethodsContent = () => (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
      <h2 className="text-2xl font-bold text-white mb-1">Payment Methods</h2>
      <p className="text-sm text-[var(--text-muted)] mb-10">Manage your payment methods</p>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] flex items-center justify-center mb-6">
          <Wallet className="w-8 h-8 text-[var(--gold-primary)]" />
        </div>
        <p className="text-white font-medium mb-1">No payment methods added yet</p>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Add a payment method to checkout faster
        </p>
        <button className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-semibold text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition">
          Add Payment Method
        </button>
      </div>
    </div>
  )

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

  const renderMyGuitarContent = () => {
    const updateBuildOption = (option, value) => {
      setGuitarBuild(prev => ({ ...prev, [option]: value }))
    }

    const selectedBodyStyle = guitarBuildOptions.bodyStyle.find(b => b.id === guitarBuild.bodyStyle)
    const totalPrice = guitarBuild.price + 
      (guitarBuildOptions.woodType.find(w => w.id === guitarBuild.woodType)?.price || 0) +
      (guitarBuildOptions.neckWood.find(w => w.id === guitarBuild.neckWood)?.price || 0) +
      (guitarBuildOptions.fretboard.find(w => w.id === guitarBuild.fretboard)?.price || 0) +
      (guitarBuildOptions.pickups.find(w => w.id === guitarBuild.pickups)?.price || 0) +
      (guitarBuildOptions.bridge.find(w => w.id === guitarBuild.bridge)?.price || 0) +
      (guitarBuildOptions.finish.find(w => w.id === guitarBuild.finish)?.price || 0) +
      (guitarBuildOptions.tuners.find(w => w.id === guitarBuild.tuners)?.price || 0)

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Build Your Guitar</h2>
            <p className="text-sm text-[var(--text-muted)]">Customize your dream guitar from scratch</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--text-muted)]">Estimated Price</p>
            <p className="text-2xl font-bold text-[var(--gold-primary)]">${totalPrice.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Guitar Preview */}
          <div>
            <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden mb-6">
              <div className="aspect-square overflow-hidden">
                <img
                  src={selectedBodyStyle?.image || 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80'}
                  alt="Guitar Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-white mb-2">
                  {selectedBodyStyle?.name || 'Custom Guitar'} Style
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {guitarBuildOptions.woodType.find(w => w.id === guitarBuild.woodType)?.name} Body •{' '}
                  {guitarBuildOptions.neckWood.find(w => w.id === guitarBuild.neckWood)?.name} Neck
                </p>
              </div>
            </div>
          </div>

          {/* Build Options */}
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
            {/* Body Style */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Body Style</h4>
              <div className="grid grid-cols-2 gap-2">
                {guitarBuildOptions.bodyStyle.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => updateBuildOption('bodyStyle', style.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      guitarBuild.bodyStyle === style.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_12px_rgba(184,134,11,0.3)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] hover:border-[var(--gold-primary)]/50 text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    <p className="text-sm font-medium">{style.name}</p>
                    {style.price > 0 && (
                      <p className={`text-xs ${guitarBuild.bodyStyle === style.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${style.price}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Wood Type */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Body Wood</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.woodType.map((wood) => (
                  <button
                    key={wood.id}
                    type="button"
                    onClick={() => updateBuildOption('woodType', wood.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.woodType === wood.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {wood.name}
                    {wood.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.woodType === wood.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${wood.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Neck Wood */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Neck Wood</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.neckWood.map((wood) => (
                  <button
                    key={wood.id}
                    type="button"
                    onClick={() => updateBuildOption('neckWood', wood.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.neckWood === wood.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {wood.name}
                    {wood.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.neckWood === wood.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${wood.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fretboard */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Fretboard</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.fretboard.map((fret) => (
                  <button
                    key={fret.id}
                    type="button"
                    onClick={() => updateBuildOption('fretboard', fret.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.fretboard === fret.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {fret.name}
                    {fret.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.fretboard === fret.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${fret.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Pickups */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Pickups</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.pickups.map((pickup) => (
                  <button
                    key={pickup.id}
                    type="button"
                    onClick={() => updateBuildOption('pickups', pickup.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.pickups === pickup.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {pickup.name}
                    {pickup.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.pickups === pickup.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${pickup.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bridge */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Bridge</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.bridge.map((bridge) => (
                  <button
                    key={bridge.id}
                    type="button"
                    onClick={() => updateBuildOption('bridge', bridge.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.bridge === bridge.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {bridge.name}
                    {bridge.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.bridge === bridge.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${bridge.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Finish */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Finish</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.finish.map((finish) => (
                  <button
                    key={finish.id}
                    type="button"
                    onClick={() => updateBuildOption('finish', finish.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.finish === finish.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {finish.name}
                    {finish.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.finish === finish.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${finish.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tuners */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Tuners</h4>
              <div className="flex flex-wrap gap-2">
                {guitarBuildOptions.tuners.map((tuner) => (
                  <button
                    key={tuner.id}
                    type="button"
                    onClick={() => updateBuildOption('tuners', tuner.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      guitarBuild.tuners === tuner.id
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)] text-black font-medium shadow-[0_0_10px_rgba(184,134,11,0.25)]'
                        : 'border-[var(--border)] bg-[var(--surface-dark)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/50 hover:text-white'
                    }`}
                  >
                    {tuner.name}
                    {tuner.price > 0 && (
                      <span className={`ml-1 ${guitarBuild.tuners === tuner.id ? 'text-black/70' : 'text-[var(--gold-primary)]'}`}>
                        +${tuner.price}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => navigate('/customize')}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
              >
                Customize Guitar
              </button>
              <button
                type="button"
                onClick={() => navigate('/appointments')}
                className="flex-1 py-3 px-4 rounded-xl border border-[var(--gold-primary)] text-[var(--gold-primary)] font-semibold hover:bg-[var(--gold-primary)]/10 transition-all"
              >
                Book Consultation
              </button>
              <button
                type="button"
                onClick={() => {
                  addToCart({
                    id: 'custom-guitar-' + Date.now(),
                    name: 'Custom Guitar - ' + selectedBodyStyle?.name,
                    price: totalPrice,
                    image: selectedBodyStyle?.image || 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800&q=80',
                    category: 'Custom Build',
                    type: 'custom',
                    specs: guitarBuild,
                  })
                  setActiveSection('cart')
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-[var(--gold-primary)] text-[var(--gold-primary)] font-semibold hover:bg-[var(--gold-primary)]/10 transition-all"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMessagesContent = () => {
    const handleSendMessage = () => {
      if (newMessage.trim()) {
        const message = {
          id: Date.now(),
          conversationId: selectedConversation,
          sender: 'You',
          avatar: 'ME',
          content: newMessage,
          timestamp: 'Just now',
          unread: false,
          isUser: true,
        }
        setMessages(prev => [...prev, message])
        setNewMessage('')
      }
    }

    const currentConversation = messages.find(m => m.id === selectedConversation)
    const conversationMessages = messages.filter(m => m.conversationId === selectedConversation || m.id === selectedConversation)

    return (
      <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-1">Messages</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Communicate with our team and staff</p>

        <div className="grid lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversations List */}
          <div className="lg:col-span-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--border)]">
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full px-4 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-white text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.filter((m, i, arr) => arr.findIndex(x => x.sender === m.sender) === i).map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedConversation(message.id)}
                  className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left border-b border-[var(--border)] ${
                    selectedConversation === message.id ? 'bg-[var(--gold-primary)]/10 border-l-2 border-[var(--gold-primary)]' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center text-[var(--text-dark)] font-bold text-sm flex-shrink-0">
                    {message.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`font-medium truncate ${message.unread ? 'text-white' : 'text-[var(--text-muted)]'}`}>
                        {message.sender}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{message.timestamp}</span>
                    </div>
                    <p className={`text-sm truncate ${message.unread ? 'text-white' : 'text-[var(--text-muted)]'}`}>
                      {message.content}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl overflow-hidden flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gold-primary)] to-[var(--gold-secondary)] flex items-center justify-center text-[var(--text-dark)] font-bold text-sm">
                {currentConversation?.avatar || 'CC'}
              </div>
              <div>
                <h4 className="font-semibold text-white">{currentConversation?.sender || 'CosmosCraft Support'}</h4>
                <p className="text-xs text-green-400">Online</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationMessages.length > 0 ? (
                conversationMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-dark)] font-bold text-xs flex-shrink-0 ${message.isUser ? 'bg-[var(--gold-primary)]' : 'bg-[var(--surface-dark)] border border-[var(--border)]'}`}>
                      {message.avatar}
                    </div>
                    <div className={`max-w-[70%] ${message.isUser ? 'text-right' : ''}`}>
                      <div className={`inline-block px-4 py-3 rounded-2xl ${
                        message.isUser
                          ? 'bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] rounded-br-md'
                          : 'bg-[var(--surface-dark)] border border-[var(--border)] text-white rounded-bl-md'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{message.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[var(--text-muted)]">Select a conversation to view messages</p>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="px-4 py-3 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] rounded-xl text-[var(--text-dark)] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
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
                        ${item.price.toLocaleString()}
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
                      Subtotal: <span className="text-white font-medium">${(item.price * item.quantity).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}

            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg text-[var(--text-muted)]">Total:</span>
                <span className="text-2xl font-bold text-[var(--gold-primary)]">${cartTotal.toLocaleString()}</span>
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
            {activeSection === 'payment-methods' && renderPaymentMethodsContent()}
            {activeSection === 'my-guitar' && renderMyGuitarContent()}
            {activeSection === 'messages' && renderMessagesContent()}
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
    </div>
  )
}

export default DashboardPage
