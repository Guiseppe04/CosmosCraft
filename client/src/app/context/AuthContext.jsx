import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { API, getAuthHeaders, setAuthToken, removeAuthToken } from '../utils/apiConfig'
import { authFetch } from '../utils/authFetch.js'
import { normalizeRole } from '../utils/roles'

import TermsAndConditionsModal from '../components/TermsAndConditionsModal'
import { accountAgreement, saveAgreement } from '../utils/termsAgreement'

const AuthContext = createContext(null)

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
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
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [termsOpen, setTermsOpen] = useState(false)
  const pendingTerms = useRef(null)
  const restoreTimer = useRef(null)
  const sessionVersion = useRef(0)
  const ensureAccountTerms = useCallback(async () => {
    const response = await authFetch(API + '/auth/terms/status', { headers: getAuthHeaders(), credentials: 'include' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Unable to check account agreement.')
    if (!data.data.required) return true
    if (!pendingTerms.current) {
      let resolve
      const promise = new Promise(done => { resolve = done })
      pendingTerms.current = { promise, resolve }
      setTermsOpen(true)
    }
    return pendingTerms.current.promise
  }, [])

  // Fetch current authenticated user from backend
  const fetchUser = useCallback(async () => {
    const version = ++sessionVersion.current
    clearTimeout(restoreTimer.current)
    let completed = false
    try {
      const response = await authFetch(`${API}/auth/check`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      })

      if (version !== sessionVersion.current) return null
      if (!response.ok) {
        const error = new Error('Unable to check session')
        error.status = response.status
        throw error
      }

      // If backend issued a new access token via header during auto-refresh
      const newAccessToken = response.headers.get('X-New-Access-Token')
      if (newAccessToken) {
        setAuthToken(newAccessToken)
      }

      if (response.ok) {
        const data = await response.json()
        if (version !== sessionVersion.current) return null
        if (data.data?.isAuthenticated && data.data?.user) {
          if (!await ensureAccountTerms()) { completed = true; return null }
          if (version !== sessionVersion.current) return null
          // If auth check doesn't include addresses, fetch profile for full data
          let userData = data.data.user

          // Fetch full profile which includes addresses
          try {
            const profileResponse = await fetch(`${API}/api/users/profile`, {
              method: 'GET',
              headers: getAuthHeaders(),
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

          if (version !== sessionVersion.current) return null
          completed = true
          setIsAuthenticated(true)
          setUser(userData)
          // Store full user data in localStorage
          window.localStorage.setItem(
            'cosmoscraft_auth',
            JSON.stringify(userData)
          )
          return userData
        }

        completed = true
        setIsAuthenticated(false)
        setUser(null)
        window.localStorage.removeItem('cosmoscraft_auth')
        removeAuthToken()
      }
    } catch (error) {
      if (version !== sessionVersion.current) return null
      if (error.status === 401 || error.status === 403) {
        completed = true
        setIsAuthenticated(false)
        setUser(null)
        window.localStorage.removeItem('cosmoscraft_auth')
        removeAuthToken()
      } else {
        // Keep protected routes waiting while the session service is unavailable.
        clearTimeout(restoreTimer.current)
        restoreTimer.current = setTimeout(() => fetchUser(), 5000)
      }
    } finally {
      if (completed && version === sessionVersion.current) setIsLoadingUser(false)
    }
    return null
  }, [ensureAccountTerms])

  // Verify authentication on app mount
  useEffect(() => {
    fetchUser()
    const onSessionExpired = () => {
      sessionVersion.current++
      clearTimeout(restoreTimer.current)
      setIsAuthenticated(false)
      setUser(null)
      setIsLoadingUser(false)
    }
    window.addEventListener('cosmoscraft:session-expired', onSessionExpired)
    return () => {
      sessionVersion.current++
      clearTimeout(restoreTimer.current)
      window.removeEventListener('cosmoscraft:session-expired', onSessionExpired)
    }
  }, [fetchUser])

  const openLogin = useCallback(callback => {
    try {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (currentPath && !currentPath.startsWith('/auth')) {
        window.sessionStorage.setItem('cosmoscraft.auth.returnTo', currentPath)
      }
    } catch {}

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
    async (userData, token = null) => {
      const version = ++sessionVersion.current
      clearTimeout(restoreTimer.current)
      if (token) setAuthToken(token)
      if (!await ensureAccountTerms()) return null
      if (version !== sessionVersion.current) return null
      setIsLoadingUser(false)
      setIsAuthenticated(true)
      setUser(userData)
      setLoginOpen(false)
      // Store full user data in localStorage
      window.localStorage.setItem('cosmoscraft_auth', JSON.stringify(userData))
      if (token) {
        setAuthToken(token)
      }
      if (loginCallback) {
        loginCallback()
        setLoginCallback(null)
      }
      return userData
    },
    [loginCallback, ensureAccountTerms],
  )

  const logout = useCallback(async () => {
    sessionVersion.current++
    clearTimeout(restoreTimer.current)
    setIsLoadingUser(false)
    setIsLoggingOut(true)

    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      })
    } catch (err) {
      console.warn('Logout API error:', err)
    } finally {
      setIsAuthenticated(false)
      setUser(null)
      window.localStorage.removeItem('cosmoscraft_auth')
      removeAuthToken()

      window.setTimeout(() => {
        setIsLoggingOut(false)
      }, 800)
    }
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
    return normalizeRole(user.role || ROLES.CUSTOMER)
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
        isLoggingOut,
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
      <TermsAndConditionsModal isOpen={termsOpen} account
        onClose={async () => {
          await logout()
          setTermsOpen(false)
          pendingTerms.current?.resolve(false)
          pendingTerms.current = null
        }}
        onAgree={async () => {
          await saveAgreement('account', accountAgreement())
          setTermsOpen(false)
          pendingTerms.current?.resolve(true)
          pendingTerms.current = null
        }} />
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

