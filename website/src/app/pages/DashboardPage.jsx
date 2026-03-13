import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { User, CreditCard, MapPin, Lock, Settings, Bell, Package, Calendar, ChevronRight, Upload, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

function NotificationRow({ setting }) {
  const [enabled, setEnabled] = useState(setting.defaultOn)

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl border border-gray-200">
      <div>
        <p className="text-sm font-semibold text-gray-900">{setting.title}</p>
        <p className="text-xs text-gray-500">{setting.desc}</p>
      </div>
      <button
        type="button"
        onClick={() => setEnabled(prev => !prev)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          enabled ? 'bg-[#d4af37]' : 'bg-gray-300'
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
  const { logout } = useAuth()
  const initialSection = location.state?.section || 'profile'
  const [activeSection, setActiveSection] = useState(initialSection)
  const [profileImage, setProfileImage] = useState('https://i.pravatar.cc/150?img=68')
  const [profileData, setProfileData] = useState({
    username: 'user@cosmoscraft.com',
    name: 'John Doe',
    email: 'user@cosmoscraft.com',
    phone: '+1 (555) 123-4567',
    gender: 'male',
    dobDay: '15',
    dobMonth: 'June',
    dobYear: '1990',
  })

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
    { id: 'banks-cards', label: 'Banks & Cards', icon: CreditCard, group: 'account' },
    { id: 'addresses', label: 'Addresses', icon: MapPin, group: 'account' },
    { id: 'password', label: 'Change Password', icon: Lock, group: 'account' },
    { id: 'privacy', label: 'Privacy Settings', icon: Settings, group: 'account' },
    { id: 'notifications', label: 'Notification Settings', icon: Bell, group: 'account' },
    { id: 'purchases', label: 'My Purchase', icon: Package, group: 'orders' },
    { id: 'appointments', label: 'My Appointments', icon: Calendar, group: 'orders' },
    { id: 'logout', label: 'Logout', icon: User, group: 'orders' },
  ]

  const renderBanksContent = () => (
    <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Banks &amp; Cards</h2>
      <p className="text-sm text-gray-500 mb-10">Manage your payment methods</p>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center mb-6">
          <CreditCard className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-700 font-medium mb-1">No payment methods added yet</p>
        <p className="text-sm text-gray-500 mb-6">
          Add a payment method to checkout faster
        </p>
        <button className="px-6 py-2.5 rounded-full bg-[#d4af37] text-sm font-semibold text-gray-900 hover:bg-[#c39d2f] transition">
          Add Payment Method
        </button>
      </div>
    </div>
  )

  const renderPurchasesContent = () => (
    <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">My Purchase</h2>
      <p className="text-sm text-gray-500 mb-8">Track and manage your orders</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-500 border-b border-gray-200 pb-3 mb-10">
        {['All', 'To Pay', 'To Ship', 'To Receive', 'Completed', 'Cancelled', 'Refund'].map(label => (
          <button
            key={label}
            className={`pb-2 border-b-2 ${
              label === 'All'
                ? 'border-[#d4af37] text-gray-900'
                : 'border-transparent hover:text-gray-900'
            }`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center mb-6">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-700 font-medium mb-1">No orders yet</p>
        <p className="text-sm text-gray-500 mb-6">
          Start shopping to see your orders here
        </p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="px-6 py-2.5 rounded-full bg-[#d4af37] text-sm font-semibold text-gray-900 hover:bg-[#c39d2f] transition"
        >
          Browse Shop
        </button>
      </div>
    </div>
  )

  const renderAppointmentsContent = () => (
    <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">My Appointments</h2>
      <p className="text-sm text-gray-500 mb-6">View and manage your service appointments</p>

      <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-500 border-b border-gray-200 pb-3 mb-10">
        {['All', 'Pending', 'Approved', 'Completed', 'Cancelled'].map(label => (
          <button
            key={label}
            className={`pb-2 border-b-2 ${
              label === 'All' ? 'border-[#d4af37] text-gray-900' : 'border-transparent hover:text-gray-900'
            }`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center mb-6">
          <Calendar className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-700 font-medium mb-1">No appointments yet</p>
        <p className="text-sm text-gray-500 mb-6">Book a service appointment to see it here</p>
        <button
          type="button"
          onClick={() => navigate('/appointments')}
          className="px-6 py-2.5 rounded-full bg-[#d4af37] text-sm font-semibold text-gray-900 hover:bg-[#c39d2f] transition"
        >
          Book Appointment
        </button>
      </div>
    </div>
  )

  const renderProfileContent = () => (
    <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">My Profile</h2>
      <p className="text-sm text-gray-500 mb-10">Manage and protect your account</p>

      <div className="flex items-center gap-6 mb-10 pb-8 border-b border-gray-200">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200">
          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">{profileData.username}</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Edit Profile
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
          <input
            type="text"
            value={profileData.username}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 bg-gray-50"
          />
          <p className="mt-1 text-[11px] text-gray-400">Username can only be changed once.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Full Name</label>
          <input
            type="text"
            value={profileData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Email</label>
          <input
            type="email"
            value={profileData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Phone Number</label>
          <input
            type="tel"
            value={profileData.phone}
            onChange={e => handleInputChange('phone', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Gender</label>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            {['male', 'female', 'other'].map(value => (
              <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                <span
                  className={`w-4 h-4 rounded-full border ${
                    profileData.gender === value ? 'border-[#d4af37] bg-[#d4af37]' : 'border-gray-400'
                  } flex items-center justify-center`}
                >
                  {profileData.gender === value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
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
          <label className="block text-xs font-semibold text-gray-600 mb-2">Date of birth</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={profileData.dobDay}
              onChange={e => handleInputChange('dobDay', e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
        className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#d4af37] text-sm font-semibold text-gray-900 hover:bg-[#c39d2f] transition"
      >
        <Save className="w-4 h-4" />
        Save Changes
      </button>
    </div>
  )

  const renderPlaceholderSection = (title, description) => (
    <div className="bg-white rounded-2xl shadow-sm px-10 py-12 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  )

  const currentMenu = menuItems.find(item => item.id === activeSection)

  return (
    <div className="min-h-screen pt-16 bg-[var(--color-light)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-[260px_minmax(0,1fr)] gap-6">
          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                <img src={profileImage} alt="User" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {profileData.username}
                </p>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="px-3 py-4 space-y-6 text-sm">
              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold text-gray-500 tracking-wide">
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                            active
                              ? 'bg-[#fff7dd] text-gray-900 border-r-4 border-[#d4af37]'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )
                    })}
                </div>
              </div>

              <div>
                <p className="px-3 mb-2 text-[11px] font-semibold text-gray-500 tracking-wide">
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
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                            isLogout
                              ? 'text-red-500 hover:bg-red-50'
                              : active
                                ? 'bg-[#fff7dd] text-gray-900 border-r-4 border-[#d4af37]'
                                : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isLogout ? 'text-red-500' : ''}`} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {!isLogout && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
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
            {activeSection === 'banks-cards' && renderBanksContent()}
            {activeSection === 'purchases' && renderPurchasesContent()}
            {activeSection === 'appointments' && renderAppointmentsContent()}

            {activeSection === 'addresses' &&
              renderPlaceholderSection(
                'Addresses',
                'Save your shipping and billing addresses to checkout faster.',
              )}
            {activeSection === 'password' &&
              (
                <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Change Password</h2>
                  <p className="text-sm text-gray-500 mb-10">
                    Update your password regularly for security
                  </p>
                  <div className="space-y-5 max-w-md">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-8 inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#d4af37] text-sm font-semibold text-gray-900 hover:bg-[#c39d2f] transition"
                  >
                    Update Password
                  </button>
                </div>
              )}
            {activeSection === 'privacy' &&
              renderPlaceholderSection(
                'Privacy Settings',
                'Control how CosmosCraft uses and protects your personal data.',
              )}
            {activeSection === 'notifications' &&
              (
                <div className="bg-white rounded-2xl shadow-sm px-10 py-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Notification Settings</h2>
                  <p className="text-sm text-gray-500 mb-8">
                    Manage how you receive notifications
                  </p>
                  <div className="space-y-3 max-w-xl">
                    {[
                      {
                        id: 'order-updates',
                        title: 'Order Updates',
                        desc: 'Get notified about order status changes',
                        defaultOn: true,
                      },
                      {
                        id: 'promos',
                        title: 'Promotions & Offers',
                        desc: 'Receive special deals and discounts',
                        defaultOn: true,
                      },
                      {
                        id: 'appointment-reminders',
                        title: 'Appointment Reminders',
                        desc: 'Get reminders for upcoming appointments',
                        defaultOn: true,
                      },
                      {
                        id: 'email-notifications',
                        title: 'Email Notifications',
                        desc: 'Receive notifications via email',
                        defaultOn: false,
                      },
                      {
                        id: 'sms-notifications',
                        title: 'SMS Notifications',
                        desc: 'Receive notifications via text message',
                        defaultOn: false,
                      },
                    ].map(setting => (
                      <NotificationRow key={setting.id} setting={setting} />
                    ))}
                  </div>
                </div>
              )}
          </motion.main>
        </div>
      </div>
    </div>
  )
}
