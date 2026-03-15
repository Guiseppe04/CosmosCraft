import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { API } from '../utils/apiConfig'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginCallback, setLoginCallback] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  // Fetch current authenticated user from backend
  const fetchUser = useCallback(async () => {
    try {
      setIsLoadingUser(true)
      const response = await fetch(`${API}/auth/check`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.data.isAuthenticated && data.data.user) {
          setIsAuthenticated(true)
          setUser(data.data.user)
          // Store full user data in localStorage
          window.localStorage.setItem(
            'cosmoscraft_auth',
            JSON.stringify(data.data.user)
          )
          return data.data.user
        }
      } else {
        // Token invalid or expired
        setIsAuthenticated(false)
        setUser(null)
        window.localStorage.removeItem('cosmoscraft_auth')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setIsAuthenticated(false)
      setUser(null)
      window.localStorage.removeItem('cosmoscraft_auth')
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
            // Verify with backend - this will refresh the token if valid
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
    if (callback) {
      setLoginCallback(() => callback)
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
        isLoadingUser,
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

