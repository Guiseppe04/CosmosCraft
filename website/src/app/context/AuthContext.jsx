import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginCallback, setLoginCallback] = useState(null)

  // Hydrate auth state from localStorage (simple demo persistence)
  useEffect(() => {
    const stored = window.localStorage.getItem('cosmoscraft_auth')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.email) {
          setIsAuthenticated(true)
          setUser({ email: parsed.email })
        }
      } catch {
        // ignore invalid storage
      }
    }
  }, [])

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
    ({ email, remember }) => {
      setIsAuthenticated(true)
      setUser({ email })
      setLoginOpen(false)
      if (remember) {
        window.localStorage.setItem('cosmoscraft_auth', JSON.stringify({ email }))
      } else {
        window.localStorage.removeItem('cosmoscraft_auth')
      }
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

