import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import type { Category } from '@/types/category'
import { useAuth } from '@/store/AuthProvider'
import { api } from '@/lib/api'

const STORAGE_KEY = 'tracker.categories'

type State = {
  categories: Category[]
}

type Action =
  | { type: 'set'; payload: Category[] }
  | { type: 'add'; payload: Category }
  | { type: 'remove'; payload: { id: string } }
  | { type: 'clear' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { categories: [...action.payload] }
    case 'add':
      return { categories: [action.payload, ...state.categories] }
    case 'remove':
      return { categories: state.categories.filter((c) => c.id !== action.payload.id) }
    case 'clear':
      return { categories: [] }
    default:
      return state
  }
}

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { categories: [] }
    const parsed = JSON.parse(raw) as Category[]
    if (!Array.isArray(parsed)) return { categories: [] }
    // basic shape guard
    const categories = parsed
      .filter((c: any) => c && typeof c.name === 'string')
      .map((c: any) => ({ id: String(c.id ?? crypto.randomUUID()), name: c.name, color: c.color }))
    return { categories }
  } catch {
    return { categories: [] }
  }
}

function persist(categories: Category[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  } catch {}
}

export type CategoriesContextValue = {
  categories: Category[]
  addCategory: (name: string, color?: string) => void
  importCategories: (input: unknown) => { imported: number; skipped: number }
  removeCategory: (id: string) => void
  clearAll: () => void
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)
  const { user } = useAuth()
  const [remoteLoaded, setRemoteLoaded] = useState(false)

  // Load categories from server when user changes
  useEffect(() => {
    setRemoteLoaded(false)
    if (!user?.id) return
    let aborted = false
    ;(async () => {
      try {
        const remote = await api.get<Category[]>(`/categories?userId=${encodeURIComponent(user.id)}`)
        if (!aborted && Array.isArray(remote)) {
          dispatch({ type: 'set', payload: remote })
        }
      } catch {}
      if (!aborted) setRemoteLoaded(true)
    })()
    return () => { aborted = true }
  }, [user?.id])

  // Persist categories: to server if authed, else to localStorage
  useEffect(() => {
    if (user?.id) {
      if (!remoteLoaded) return
      api.put('/categories', { userId: user.id, categories: state.categories }).catch(() => {})
    } else {
      persist(state.categories)
    }
  }, [user?.id, remoteLoaded, state.categories])

  const addCategory = useCallback((name: string, color?: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    // de-dupe by case-insensitive name
    const exists = state.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (exists) return
    dispatch({ type: 'add', payload: { id: crypto.randomUUID(), name: trimmed, color } })
  }, [state.categories])

  const removeCategory = useCallback((id: string) => {
    dispatch({ type: 'remove', payload: { id } })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'clear' })
  }, [])

  const importCategories = useCallback((input: unknown) => {
    // Accept single string/object or an array of such values
    let items: { name: string; id?: string; color?: string }[] = []

    const normalize = (it: any) => {
      if (typeof it === 'string') return { name: it }
      if (it && typeof it.name === 'string') return { name: it.name, id: it.id, color: it.color }
      return null
    }

    if (Array.isArray(input)) {
      items = input.map(normalize).filter(Boolean) as any
    } else {
      const one = normalize(input)
      if (one) items = [one]
    }

    if (!items.length) return { imported: 0, skipped: 0 }

    const existingNames = new Set(state.categories.map((c) => c.name.toLowerCase()))
    const toAdd: Category[] = []
    let skipped = 0
    for (const it of items) {
      const nm = it.name.trim()
      if (!nm || existingNames.has(nm.toLowerCase())) {
        skipped += 1
        continue
      }
      existingNames.add(nm.toLowerCase())
      toAdd.push({ id: String(it.id ?? crypto.randomUUID()), name: nm, color: it.color })
    }

    if (toAdd.length) {
      const next = [...toAdd, ...state.categories]
      dispatch({ type: 'set', payload: next })
      return { imported: toAdd.length, skipped }
    }
    return { imported: 0, skipped }
  }, [state.categories])

  const value = useMemo<CategoriesContextValue>(() => ({
    categories: state.categories,
    addCategory,
    importCategories,
    removeCategory,
    clearAll,
  }), [state.categories, addCategory, importCategories, removeCategory, clearAll])

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider')
  return ctx
}
