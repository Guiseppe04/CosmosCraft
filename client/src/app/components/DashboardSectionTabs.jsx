import {
  User,
  MapPin,
  Lock,
  Music,
  Calendar,
  ShoppingCart,
  ShoppingBag,
} from 'lucide-react'
import '../../styles/DashboardTabs.css'

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'password', label: 'Change Password', icon: Lock },
  { id: 'my-guitar', label: 'My Guitar', icon: Music },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'cart', label: 'My Cart', icon: ShoppingCart },
  { id: 'purchases', label: 'My Purchases', icon: ShoppingBag },
]

export function DashboardSectionTabs({ activeSection, onSectionChange }) {
  return (
    <div className="dash-nav-outer">
      <div className="dash-nav-scroll">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id
          const Icon = section.icon

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`dash-tab-btn ${isActive ? 'dash-tab-btn--active' : ''}`}
            >
              <Icon className="dash-tab-icon" />
              <span className="dash-tab-label">{section.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}