import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { API } from '../utils/apiConfig'

const AuthContext = createContext(null)

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  CUSTOMER: 'customer',
}

// Permission constants for RBAC
export const PERMISSIONS = {
  // Product management
  VIEW_PRODUCTS: 'view_products',
  ADD_PRODUCT: 'add_product',
  UPDATE_PRODUCT: 'update_product',
  DELETE_PRODUCT: 'delete_product',
  
  // User management
  VIEW_USERS: 'view_users',
  
  // Order management
  VIEW_ORDERS: 'view_orders',
  APPROVE_ORDER: 'approve_order',
  CANCEL_ORDER: 'cancel_order',
  
  // Project management
  VIEW_PROJECTS: 'view_projects',
  UPDATE_PROJECT: 'update_project',
  
  // Appointment management
  VIEW_APPOINTMENTS: 'view_appointments',
  APPROVE_APPOINTMENT: 'approve_appointment',
  CANCEL_APPOINTMENT: 'cancel_appointment',
  
  // Reports
  VIEW_REPORTS: 'view_reports',
  
  // Guitar designs
  VIEW_DESIGNS: 'view_designs',
  REMOVE_DESIGN: 'remove_design',
  
  // Feedback
  VIEW_FEEDBACK: 'view_feedback',
  
  // Cart operations
  ADD_TO_CART: 'add_to_cart',
  BUY_NOW: 'buy_now',
  CHECKOUT: 'checkout',
}

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS), // All permissions
  ],
  [ROLES.STAFF]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_DESIGNS,
    PERMISSIONS.UPDATE_PROJECT,
    PERMISSIONS.REMOVE_DESIGN,
    PERMISSIONS.VIEW_FEEDBACK,
    PERMISSIONS.VIEW_APPOINTMENTS,
    PERMISSIONS.APPROVE_ORDER,
    PERMISSIONS.CANCEL_ORDER,
    PERMISSIONS.APPROVE_APPOINTMENT,
    PERMISSIONS.CANCEL_APPOINTMENT,
    PERMISSIONS.ADD_TO_CART,
    PERMISSIONS.BUY_NOW,
    PERMISSIONS.CHECKOUT,
  ],
  [ROLES.CUSTOMER]: [
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_ORDERS,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_DESIGNS,
    PERMISSIONS.VIEW_APPOINTMENTS,
    PERMISSIONS.ADD_TO_CART,
    PERMISSIONS.BUY_NOW,
    PERMISSIONS.CHECKOUT,
  ],
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginCallback, setLoginCallback] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  
  // Fetch current authenticated user from backend
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch(`${API}/auth/check`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.data.isAuthenticated && data.data.user) {
          // If auth check doesn't include addresses, fetch profile for full data
          let userData = data.data.user
          
          // Fetch full profile which includes addresses
          try {
            const profileResponse = await fetch(`${API}/api/users/profile`, {
              method: 'GET',
              credentials: 'include',
            })
            if (profileResponse.ok) {
              const profileData = await profileResponse.json()
              if (profileData.data?.user) {
                userData = profileData.data.user
              }
            }
          } catch (profileErr) {
            console.warn('Could not fetch full profile, using auth data')
          }
          
          setIsAuthenticated(true)
          setUser(userData)
          // Store full user data in localStorage
          window.localStorage.setItem(
            'cosmoscraft_auth',
            JSON.stringify(userData)
          )
          return userData
        }
      } else if (response.status === 401) {
        setIsAuthenticated(false)
        setUser(null)
        window.localStorage.removeItem('cosmoscraft_auth')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setIsLoadingUser(false)
    }
    return null
  }, [])

  // Verify authentication on app mount
  useEffect(() => {
    const verifyAuth = async () => {
      const stored = window.localStorage.getItem('cosmoscraft_auth')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.id || parsed?._id) {
            // Restore user immediately from localStorage
            setIsAuthenticated(true)
            setUser(parsed)
            setIsLoadingUser(false)
            
            // Verify with backend in background
            await fetchUser()
          } else {
            setIsLoadingUser(false)
          }
        } catch {
          window.localStorage.removeItem('cosmoscraft_auth')
          setIsLoadingUser(false)
        }
      } else {
        setIsLoadingUser(false)
      }
    }

    verifyAuth()
  }, [fetchUser])

  const openLogin = useCallback(callback => {
    setLoginOpen(true)
    if (typeof callback === 'function') {
      setLoginCallback(() => callback)
    } else {
      setLoginCallback(null)
    }
  }, [])

  const closeLogin = useCallback(() => {
    setLoginOpen(false)
    setLoginCallback(null)
  }, [])

  const login = useCallback(
    (userData) => {
      setIsAuthenticated(true)
      setUser(userData)
      setLoginOpen(false)
      // Store full user data in localStorage
      window.localStorage.setItem('cosmoscraft_auth', JSON.stringify(userData))
      if (loginCallback) {
        loginCallback()
        setLoginCallback(null)
      }
    },
    [loginCallback],
  )

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    setUser(null)
    window.localStorage.removeItem('cosmoscraft_auth')
  }, [])

  // Update user data (e.g., after adding address)
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates }
      window.localStorage.setItem('cosmoscraft_auth', JSON.stringify(updated))
      return updated
    })
  }, [])

  // Role checking helpers
  const getUserRole = useCallback(() => {
    if (!user) return null
    return user.role || ROLES.CUSTOMER
  }, [user])

  const isAdmin = useCallback(() => {
    return getUserRole() === ROLES.ADMIN
  }, [getUserRole])

  const isStaff = useCallback(() => {
    return getUserRole() === ROLES.STAFF
  }, [getUserRole])

  const isCustomer = useCallback(() => {
    const role = getUserRole()
    return role === ROLES.CUSTOMER || role === null
  }, [getUserRole])

  // Permission checking
  const hasPermission = useCallback((permission) => {
    const role = getUserRole()
    if (!role) return false
    const permissions = ROLE_PERMISSIONS[role] || []
    return permissions.includes(permission)
  }, [getUserRole])

  const hasAnyPermission = useCallback((permissionList) => {
    return permissionList.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = useCallback((permissionList) => {
    return permissionList.every(permission => hasPermission(permission))
  }, [hasPermission])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loginOpen,
        openLogin,
        closeLogin,
        login,
        logout,
        fetchUser,
        updateUser,
        isLoadingUser,
        // Role helpers
        getUserRole,
        isAdmin,
        isStaff,
        isCustomer,
        // Permission helpers
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        // Constants
        ROLES,
        PERMISSIONS,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

