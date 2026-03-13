'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const AUTH_TOKEN_KEY = 'syde30_auth_token'

export interface AuthUser {
  id: string
  email: string
  name: string
  has_seen_join_stamp_animation?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (token: string) => void
  logout: () => void
  setUserFromToken: (token: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const setUserFromToken = useCallback((token: string) => {
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
        else {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          setUser(null)
        }
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        setUser(null)
      })
  }, [])

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
    if (token) {
      setUserFromToken(token)
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [setUserFromToken])

  const login = useCallback((token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    setUserFromToken(token)
  }, [setUserFromToken])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUserFromToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
