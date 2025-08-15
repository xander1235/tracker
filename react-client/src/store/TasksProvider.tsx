import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { useAuth } from '@/store/AuthProvider'
import { api } from '@/lib/api'

const STORAGE_KEY = 'tracker.tasks'

type Progress = { completed: number; total: number }

// Plan/task types
type ImportedPlan = {
  title: string
  schedule: Array<{
    week: number
    topic?: string
    days: Array<{
      day: string // e.g., "1-2", "3-4", or single "5"
      description?: string
      patterns?: Array<{
        name: string
        problems: string[]
      }>
      activities?: string[]
    }>
  }>
}

type TaskKey = string
type Subtask = { id: string; title: string; completed?: boolean; notes?: string; children?: Subtask[] }
type TaskMeta = { completed?: boolean; notes?: string; subtasks?: Subtask[]; tags?: string[]; titleOverride?: string }
type PlanState = { title: string; startDate: string | null; raw: ImportedPlan; tasks: Record<TaskKey, TaskMeta> }

type State = {
  started: Record<string, boolean>
  progress: Record<string, Progress>
  plans: Record<string, PlanState>
}

type Action =
  | { type: 'set'; payload: State }
  | { type: 'start'; categoryId: string }
  | { type: 'setProgress'; categoryId: string; progress: Progress }
  | { type: 'importPlan'; categoryId: string; plan: ImportedPlan; startDate: string | null }
  | { type: 'toggleTask'; categoryId: string; key: TaskKey }
  | { type: 'setTaskNotes'; categoryId: string; key: TaskKey; notes: string }
  | { type: 'addSubtask'; categoryId: string; key: TaskKey; title: string; notes?: string; parentId?: string }
  | { type: 'toggleSubtask'; categoryId: string; key: TaskKey; subtaskId: string }
  | { type: 'removeSubtask'; categoryId: string; key: TaskKey; subtaskId: string }
  | { type: 'addTask'; categoryId: string; input: { week: number; day: string; kind: 'activity' | 'problem'; title: string; patternName?: string } }
  | { type: 'setSubtaskNotes'; categoryId: string; key: TaskKey; subtaskId: string; notes: string }
  | { type: 'renameSubtask'; categoryId: string; key: TaskKey; subtaskId: string; title: string }
  | { type: 'renameTask'; categoryId: string; key: TaskKey; title: string }
  | { type: 'removeTask'; categoryId: string; key: TaskKey }

function loadInitial(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { started: {}, progress: {}, plans: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { started: {}, progress: {}, plans: {} }
    return { started: parsed.started ?? {}, progress: parsed.progress ?? {}, plans: parsed.plans ?? {} }
  } catch {
    return { started: {}, progress: {}, plans: {} }
  }
}

function persist(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

// Helpers to mirror Tasks.tsx key generation and compute progress
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function makeTaskKey(categoryId: string, week: number, day: string, bucket: string, title: string): string {
  return `${categoryId}__w${week}__d${day}__${slug(bucket)}__${slug(title)}`
}
function computeProgressForPlan(categoryId: string, plan: PlanState | undefined): Progress {
  if (!plan) return { completed: 0, total: 0 }
  const tasksState = plan.tasks ?? {}
  let completed = 0
  let total = 0
  // Count leaf-only: only leaf subtasks contribute to totals; if no subtasks exist, the parent task counts as one unit elsewhere
  function countSubStats(list: Subtask[] | undefined): { completed: number; total: number } {
    let c = 0
    let t = 0
    function walk(arr?: Subtask[]) {
      for (const s of arr ?? []) {
        const kids = s.children ?? []
        if (kids.length > 0) {
          walk(kids)
        } else {
          t += 1
          if (s.completed) c += 1
        }
      }
    }
    walk(list)
    return { completed: c, total: t }
  }
  for (const wk of plan.raw?.schedule ?? []) {
    for (const day of wk.days ?? []) {
      if (day.patterns) {
        for (const p of day.patterns) {
          for (const pr of p.problems ?? []) {
            const key = makeTaskKey(categoryId, wk.week, day.day, p.name ?? 'pattern', pr)
            const meta = tasksState[key]
            const subs = countSubStats(meta?.subtasks)
            if (subs.total > 0) {
              total += subs.total
              completed += subs.completed
            } else {
              total += 1
              if (meta?.completed) completed += 1
            }
          }
        }
      }
      if (day.activities) {
        for (const act of day.activities) {
          const key = makeTaskKey(categoryId, wk.week, day.day, 'activity', act)
          const meta = tasksState[key]
          const subs = countSubStats(meta?.subtasks)
          if (subs.total > 0) {
            total += subs.total
            completed += subs.completed
          } else {
            total += 1
            if (meta?.completed) completed += 1
          }
        }
      }
    }
  }
  return { completed, total }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return action.payload
    case 'start': {
      if (state.started[action.categoryId]) return state
      const started = { ...state.started, [action.categoryId]: true }
      const progress = { ...state.progress }
      if (!progress[action.categoryId]) progress[action.categoryId] = { completed: 0, total: 0 }
      return { ...state, started, progress }
    }
    case 'setProgress': {
      const progress = { ...state.progress, [action.categoryId]: { ...action.progress } }
      return { ...state, progress }
    }
    case 'importPlan': {
      const plans = { ...state.plans }
      plans[action.categoryId] = {
        title: action.plan.title,
        startDate: action.startDate ?? null,
        raw: action.plan,
        tasks: plans[action.categoryId]?.tasks ?? {},
      }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    case 'toggleTask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const prev = tasks[action.key]?.completed ?? false
      const next = !prev
      const current = tasks[action.key] ?? {}
      function markAll(list: Subtask[] | undefined, value: boolean): Subtask[] | undefined {
        if (!list) return list
        return list.map(s => ({ ...s, completed: value, children: markAll(s.children, value) }))
      }
      tasks[action.key] = { ...current, completed: next, subtasks: markAll(current.subtasks, next) }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    case 'setTaskNotes': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      tasks[action.key] = { ...(tasks[action.key] ?? {}), notes: action.notes }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      return { ...state, plans }
    }
    case 'renameTask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      tasks[action.key] = { ...(tasks[action.key] ?? {}), titleOverride: action.title }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      return { ...state, plans }
    }
    case 'removeTask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      // remove meta for this task key
      if (tasks[action.key]) delete tasks[action.key]

      // parse key parts: ... __w<week> __d<day> __<bucketSlug> __<titleSlug>
      const parts = action.key.split('__')
      const [wPart, dPart, bucketSlug, titleSlug] = parts.slice(-4)
      const week = parseInt(wPart?.slice(1) ?? '0', 10)
      const dayRaw = (dPart ?? '').slice(1)

      // rebuild schedule immutably
      const schedule = (cat.raw?.schedule ?? []).map(w => {
        if (w.week !== week) return w
        const days = (w.days ?? []).map(d => {
          if (String(d.day) !== String(dayRaw)) return d
          // remove from activities or from a pattern's problems
          let activities = d.activities ? [...d.activities] : undefined
          let patterns = d.patterns ? d.patterns.map(p => ({ ...p, problems: [...(p.problems ?? [])] })) : undefined

          if (bucketSlug === 'activity') {
            activities = (activities ?? []).filter(act => slug(act) !== titleSlug)
          } else {
            patterns = (patterns ?? [])
              .map(p => slug(p.name) === bucketSlug ? { ...p, problems: (p.problems ?? []).filter(pr => slug(pr) !== titleSlug) } : p)
              .filter(p => (p.problems ?? []).length > 0)
          }

          return { ...d, activities, patterns }
        }).filter(d => (d.activities ?? []).length > 0 || (d.patterns ?? []).length > 0)
        return { ...w, days }
      }).filter(w => (w.days ?? []).length > 0)

      const plans = {
        ...state.plans,
        [action.categoryId]: { ...cat, raw: { ...cat.raw, schedule }, tasks }
      }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    case 'addSubtask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const current = tasks[action.key] ?? {}
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newNode: Subtask = { id, title: action.title, completed: false, notes: action.notes }

      function addToTree(list: Subtask[], parentId: string): Subtask[] {
        return list.map(s => {
          if (s.id === parentId) {
            const children = [ ...(s.children ?? []), newNode ]
            return { ...s, children }
          }
          return { ...s, children: s.children ? addToTree(s.children, parentId) : s.children }
        })
      }

      let subs = [ ...(current.subtasks ?? []) ]
      if (action.parentId) {
        // try to add under the specified parent; if parent not found, append at root
        const before = JSON.stringify(subs)
        subs = addToTree(subs, action.parentId)
        const after = JSON.stringify(subs)
        if (before === after) subs.push(newNode)
      } else {
        subs.push(newNode)
      }
      tasks[action.key] = { ...current, subtasks: subs }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      return { ...state, plans }
    }
    case 'toggleSubtask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const current = tasks[action.key]
      if (!current || !current.subtasks) return state
      const targetId = action.subtaskId
      function findNode(list: Subtask[] | undefined): Subtask | null {
        if (!list) return null
        for (const s of list) {
          if (s.id === targetId) return s
          const found = findNode(s.children)
          if (found) return found
        }
        return null
      }
      const target = findNode(current.subtasks)
      if (!target) return state
      const next = !target.completed
      const hasChildren = (target.children ?? []).length > 0

      function markAll(node: Subtask, value: boolean): Subtask {
        const children = node.children?.map(c => markAll(c, value))
        return { ...node, completed: value, children }
      }
      function applyToggle(list: Subtask[]): Subtask[] {
        return list.map(s => {
          if (s.id === targetId) {
            return hasChildren ? markAll(s, next) : { ...s, completed: next }
          }
          return { ...s, children: s.children ? applyToggle(s.children) : s.children }
        })
      }
      function propagate(list: Subtask[] | undefined): Subtask[] | undefined {
        if (!list) return list
        const childrenFixed = list.map(s => ({ ...s, children: propagate(s.children) }))
        return childrenFixed.map(s => {
          const kids = s.children ?? []
          if (kids.length === 0) return s
          const done = kids.every(k => !!k.completed)
          return { ...s, completed: done }
        })
      }
      const toggled = applyToggle(current.subtasks)
      const subs = propagate(toggled) as Subtask[]
      const parentCompleted = subs.length > 0 && subs.every(s => !!s.completed)
      tasks[action.key] = { ...current, completed: parentCompleted, subtasks: subs }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    case 'removeSubtask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const current = tasks[action.key]
      if (!current || !current.subtasks) return state
      const targetId = action.subtaskId
      function remove(list: Subtask[]): Subtask[] {
        return list
          .filter(s => s.id !== targetId)
          .map(s => ({ ...s, children: s.children ? remove(s.children) : s.children }))
      }
      function propagate(list: Subtask[] | undefined): Subtask[] | undefined {
        if (!list) return list
        const childrenFixed = list.map(s => ({ ...s, children: propagate(s.children) }))
        return childrenFixed.map(s => {
          const kids = s.children ?? []
          if (kids.length === 0) return s
          const done = kids.every(k => !!k.completed)
          return { ...s, completed: done }
        })
      }
      const removed = remove(current.subtasks)
      const subs = propagate(removed) as Subtask[]
      const parentCompleted = subs.length > 0 && subs.every(s => !!s.completed)
      tasks[action.key] = { ...current, completed: parentCompleted, subtasks: subs }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    case 'setSubtaskNotes': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const current = tasks[action.key]
      if (!current || !current.subtasks) return state
      const targetId = action.subtaskId
      const newNotes = action.notes
      function setNotes(list: Subtask[]): Subtask[] {
        return list.map(s => s.id === targetId
          ? { ...s, notes: newNotes }
          : { ...s, children: s.children ? setNotes(s.children) : s.children }
        )
      }
      const subs = setNotes(current.subtasks)
      tasks[action.key] = { ...current, subtasks: subs }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      return { ...state, plans }
    }
    case 'renameSubtask': {
      const cat = state.plans[action.categoryId]
      if (!cat) return state
      const tasks = { ...(cat.tasks ?? {}) }
      const current = tasks[action.key]
      if (!current || !current.subtasks) return state
      const targetId = action.subtaskId
      const newTitle = action.title
      function rename(list: Subtask[]): Subtask[] {
        return list.map(s => s.id === targetId
          ? { ...s, title: newTitle }
          : { ...s, children: s.children ? rename(s.children) : s.children }
        )
      }
      const subs = rename(current.subtasks)
      tasks[action.key] = { ...current, subtasks: subs }
      const plans = { ...state.plans, [action.categoryId]: { ...cat, tasks } }
      return { ...state, plans }
    }
    case 'addTask': {
      const existing = state.plans[action.categoryId]
      const base: PlanState = existing ?? {
        title: 'Ad-hoc Plan',
        startDate: null,
        raw: { title: 'Ad-hoc Plan', schedule: [] },
        tasks: {},
      }
      const planRaw = base.raw
      // Build a new schedule with the new task inserted immutably
      let foundWeek = false
      const schedule = (planRaw.schedule ?? []).map(w => {
        if (w.week !== action.input.week) return w
        foundWeek = true
        let foundDay = false
        const days = (w.days ?? []).map(d => {
          if (String(d.day) !== String(action.input.day)) return d
          foundDay = true
          if (action.input.kind === 'activity') {
            const activities = [...(d.activities ?? []), action.input.title]
            return { ...d, activities }
          } else {
            const name = action.input.patternName?.trim() || 'General'
            const patterns = [...(d.patterns ?? [])]
            const idx = patterns.findIndex(p => p.name === name)
            if (idx >= 0) {
              const p = patterns[idx]
              patterns[idx] = { ...p, problems: [...(p.problems ?? []), action.input.title] }
            } else {
              patterns.push({ name, problems: [action.input.title] })
            }
            return { ...d, patterns }
          }
        })
        // If day not found, create it
        if (!foundDay) {
          if (action.input.kind === 'activity') {
            days.push({ day: action.input.day, activities: [action.input.title] })
          } else {
            const name = action.input.patternName?.trim() || 'General'
            days.push({ day: action.input.day, patterns: [{ name, problems: [action.input.title] }] })
          }
        }
        return { ...w, days }
      })
      // If week not found, create it
      const newSchedule = foundWeek
        ? schedule
        : (() => {
            const newWeek = action.input.kind === 'activity'
              ? { week: action.input.week, days: [{ day: action.input.day, activities: [action.input.title] }] }
              : { week: action.input.week, days: [{ day: action.input.day, patterns: [{ name: action.input.patternName?.trim() || 'General', problems: [action.input.title] }] }] }
            return [...(planRaw.schedule ?? []), newWeek]
          })()
      const plans = {
        ...state.plans,
        [action.categoryId]: {
          ...base,
          raw: { ...planRaw, schedule: newSchedule },
        },
      }
      const progress = { ...state.progress, [action.categoryId]: computeProgressForPlan(action.categoryId, plans[action.categoryId]) }
      return { ...state, plans, progress }
    }
    default:
      return state
  }
}

export type TasksContextValue = {
  isStarted: (categoryId: string) => boolean
  getProgress: (categoryId: string) => Progress
  start: (categoryId: string) => void
  setProgress: (categoryId: string, progress: Progress) => void
  importPlan: (categoryId: string, plan: ImportedPlan, startDate: string | null) => void
  getPlan: (categoryId: string) => PlanState | null
  toggleTask: (categoryId: string, key: TaskKey) => void
  setTaskNotes: (categoryId: string, key: TaskKey, notes: string) => void
  addSubtask: (categoryId: string, key: TaskKey, title: string, notes?: string, parentId?: string) => void
  toggleSubtask: (categoryId: string, key: TaskKey, subtaskId: string) => void
  removeSubtask: (categoryId: string, key: TaskKey, subtaskId: string) => void
  setSubtaskNotes: (categoryId: string, key: TaskKey, subtaskId: string, notes: string) => void
  renameSubtask: (categoryId: string, key: TaskKey, subtaskId: string, title: string) => void
  addTask: (categoryId: string, input: { week: number; day: string; kind: 'activity' | 'problem'; title: string; patternName?: string }) => void
  renameTask: (categoryId: string, key: TaskKey, title: string) => void
  removeTask: (categoryId: string, key: TaskKey) => void
}

const TasksContext = createContext<TasksContextValue | null>(null)

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)
  const { user } = useAuth()
  const [remoteLoaded, setRemoteLoaded] = useState(false)

  // Load from server when user changes, else reset to local storage state
  useEffect(() => {
    let aborted = false
    setRemoteLoaded(false)
    if (!user?.id) {
      // Reset to local storage snapshot when logged out
      const local = loadInitial()
      if (!aborted) dispatch({ type: 'set', payload: local })
      return () => { aborted = true }
    }
    ;(async () => {
      try {
        const remote = await api.get<State>(`/tasks/state?userId=${encodeURIComponent(user.id)}`)
        if (!aborted && remote && typeof remote === 'object') {
          dispatch({ type: 'set', payload: remote })
        }
      } catch {}
      if (!aborted) setRemoteLoaded(true)
    })()
    return () => { aborted = true }
  }, [user?.id])

  // Persist: when authed and after initial remote load, save to server; otherwise localStorage
  useEffect(() => {
    if (user?.id) {
      if (!remoteLoaded) return
      api.put('/tasks/state', { userId: user.id, state }).catch(() => {})
    } else {
      persist(state)
    }
  }, [user?.id, remoteLoaded, state])

  // Ensure progress stays aligned with the current counting rule (leaf-only)
  // This recomputes progress from plans on mount and whenever plans change.
  useEffect(() => {
    for (const [id, plan] of Object.entries(state.plans)) {
      const computed = computeProgressForPlan(id, plan)
      const prev = state.progress[id] ?? { completed: 0, total: 0 }
      if (prev.completed !== computed.completed || prev.total !== computed.total) {
        dispatch({ type: 'setProgress', categoryId: id, progress: computed })
      }
    }
  }, [state.plans])

  const isStarted = useCallback((id: string) => {
    return !!state.started[id]
  }, [state.started])

  const getProgress = useCallback((id: string): Progress => {
    return state.progress[id] ?? { completed: 0, total: 0 }
  }, [state.progress])

  const start = useCallback((id: string) => {
    dispatch({ type: 'start', categoryId: id })
  }, [])

  const setProgress = useCallback((id: string, progress: Progress) => {
    dispatch({ type: 'setProgress', categoryId: id, progress })
  }, [])

  const importPlan = useCallback((id: string, plan: ImportedPlan, startDate: string | null) => {
    dispatch({ type: 'importPlan', categoryId: id, plan, startDate })
  }, [])

  const getPlan = useCallback((id: string): PlanState | null => {
    return state.plans[id] ?? null
  }, [state.plans])

  const toggleTask = useCallback((id: string, key: TaskKey) => {
    dispatch({ type: 'toggleTask', categoryId: id, key })
  }, [])

  const setTaskNotes = useCallback((id: string, key: TaskKey, notes: string) => {
    dispatch({ type: 'setTaskNotes', categoryId: id, key, notes })
  }, [])

  const addSubtask = useCallback((id: string, key: TaskKey, title: string, notes?: string, parentId?: string) => {
    dispatch({ type: 'addSubtask', categoryId: id, key, title, notes, parentId })
  }, [])

  const toggleSubtask = useCallback((id: string, key: TaskKey, subtaskId: string) => {
    dispatch({ type: 'toggleSubtask', categoryId: id, key, subtaskId })
  }, [])

  const removeSubtask = useCallback((id: string, key: TaskKey, subtaskId: string) => {
    dispatch({ type: 'removeSubtask', categoryId: id, key, subtaskId })
  }, [])

  const setSubtaskNotes = useCallback((id: string, key: TaskKey, subtaskId: string, notes: string) => {
    dispatch({ type: 'setSubtaskNotes', categoryId: id, key, subtaskId, notes })
  }, [])

  const renameSubtask = useCallback((id: string, key: TaskKey, subtaskId: string, title: string) => {
    dispatch({ type: 'renameSubtask', categoryId: id, key, subtaskId, title })
  }, [])

  const renameTask = useCallback((id: string, key: TaskKey, title: string) => {
    dispatch({ type: 'renameTask', categoryId: id, key, title })
  }, [])

  const removeTask = useCallback((id: string, key: TaskKey) => {
    dispatch({ type: 'removeTask', categoryId: id, key })
  }, [])

  const addTask = useCallback((id: string, input: { week: number; day: string; kind: 'activity' | 'problem'; title: string; patternName?: string }) => {
    dispatch({ type: 'addTask', categoryId: id, input })
  }, [])

  const value = useMemo<TasksContextValue>(() => ({ isStarted, getProgress, start, setProgress, importPlan, getPlan, toggleTask, setTaskNotes, addSubtask, toggleSubtask, removeSubtask, setSubtaskNotes, renameSubtask, addTask, renameTask, removeTask }), [isStarted, getProgress, start, setProgress, importPlan, getPlan, toggleTask, setTaskNotes, addSubtask, toggleSubtask, removeSubtask, setSubtaskNotes, renameSubtask, addTask, renameTask, removeTask])

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}

export function useTasks() {
  const ctx = useContext(TasksContext)
  if (!ctx) throw new Error('useTasks must be used within TasksProvider')
  return ctx
}
