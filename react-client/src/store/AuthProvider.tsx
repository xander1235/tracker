import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

export type User = {
  id: string
  email: string
  name?: string
}

type AuthContextValue = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const STORAGE_KEY = 'tracker.auth'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage synchronously to prevent auth-redirect flicker
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<User>('/auth/login', { email, password })
    setUser(res)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<User>('/auth/signup', { name, email, password })
    setUser(res)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, login, signup, logout }), [user, login, signup, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
