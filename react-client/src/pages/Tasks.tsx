import { useEffect, useMemo, useState } from 'react'
import { SquarePlus, Plus, CornerDownRight, StickyNote, Pencil, Trash2, ArrowLeft, Search, Calendar, Tag, FileDown, MoreVertical } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useCategories } from '@/store/CategoriesProvider'
import { useTasks } from '@/store/TasksProvider'

type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year'

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarterly' },
  { key: 'half', label: 'Half-yearly' },
  { key: 'year', label: 'Yearly' },
]

// Local types to mirror TasksProvider state shapes (for rendering only)
type Subtask = { id: string; title: string; completed?: boolean; notes?: string; children?: Subtask[] }
type TaskMeta = { completed?: boolean; notes?: string; subtasks?: Subtask[]; tags?: string[]; titleOverride?: string }
type ImportedPlan = {
  title: string
  schedule: Array<{
    week: number
    topic?: string
    days: Array<{
      day: string
      description?: string
      patterns?: Array<{ name: string; problems: string[] }>
      activities?: string[]
    }>
  }>
}
type PlanState = { title: string; startDate: string | null; raw: ImportedPlan; tasks: Record<string, TaskMeta> }

export default function TasksPage() {
  const { categoryId } = useParams()
  const { categories } = useCategories()
  const category = categories.find((c) => c.id === categoryId)
  const [mode, setMode] = useState<ViewMode>('day')
  const { getPlan, importPlan, toggleTask, setTaskNotes, addSubtask, toggleSubtask, removeSubtask, setSubtaskNotes, renameSubtask, addTask, renameTask, removeTask } = useTasks()
  const plan = categoryId ? getPlan(categoryId) : null
  // Removed start date selection for import; plan start date can be set elsewhere if needed
  const [jsonInput, setJsonInput] = useState<string>('')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [addDefaults, setAddDefaults] = useState<{ week: number; day: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchTick, setSearchTick] = useState(0)
  const [tagFilter, setTagFilter] = useState<string>('')

  const availableTags = useMemo(() => {
    if (!plan) return [] as string[]
    const tags = new Set<string>()
    // From schedule pattern names
    for (const wk of plan.raw?.schedule ?? []) {
      for (const day of wk.days ?? []) {
        for (const p of day.patterns ?? []) {
          if (p?.name) tags.add(p.name)
        }
      }
    }
    // From task meta tags
    for (const key of Object.keys(plan.tasks ?? {})) {
      for (const t of (plan.tasks?.[key]?.tags ?? [])) tags.add(t)
    }
    return Array.from(tags).sort((a,b) => a.localeCompare(b))
  }, [plan])

  const periodLabel = useMemo(() => {
    switch (mode) {
      case 'day':
        return 'Day-wise'
      case 'week':
        return 'Grouped by Week'
      case 'month':
        return 'Grouped by Month'
      case 'quarter':
        return 'Grouped by Quarter'
      case 'half':
        return 'Grouped by Half-year'
      case 'year':
        return 'Grouped by Year'
    }
  }, [mode])

  if (!category) {
    return (
      <section>
        <h1>Tasks</h1>
        <p className="muted">Plan not found.</p>
        <Link to="/home">Back to Home</Link>
      </section>
    )
  }

  return (
    <section>
      <div className="row between" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{category.name}</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/home" className="btn-ghost" aria-label="Back to Home">
            <ArrowLeft size={16} aria-hidden="true" style={{ marginRight: 6 }} />
            Back
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="row toolbar-controls" style={{ gap: 12, alignItems: 'center', flex: 1 }}>
            <label className="tile-sub" htmlFor="view-mode">View</label>
            <div className="input-wrap view" style={{ width: 160 }}>
              <Calendar className="icon" width={18} height={18} aria-hidden="true" />
              <select id="view-mode" aria-label="View mode" value={mode} onChange={(e) => setMode(e.target.value as ViewMode)} className="input has-icon">
                {VIEW_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div className="input-wrap tag" style={{ width: 200 }}>
              <Tag className="icon" width={18} height={18} aria-hidden="true" />
              <select
                className="input has-icon"
                aria-label="Filter by tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="">All tags</option>
                {availableTags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="input-wrap search" style={{ flex: 1, minWidth: 240 }}>
              <Search className="icon" width={18} height={18} aria-hidden="true" />
              <input
                type="search"
                className="input has-icon"
                placeholder="Search tasks..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearchTick((n) => n + 1) }}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-primary btn-icon btn-icon-lg"
              onClick={() => setAddOpen(true)}
              title="Add task"
              aria-label="Add task"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn-ghost btn-icon btn-icon-lg"
              onClick={() => setImportOpen(true)}
              title="Import plan"
              aria-label="Import plan"
            >
              <FileDown size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        <span>Viewing: {periodLabel}</span>
      </div>

      <SectionsList
        categoryId={categoryId!}
        plan={plan}
        mode={mode}
        periodLabel={periodLabel}
        searchQuery={query}
        searchTick={searchTick}
        selectedTag={tagFilter}
        expandedNotes={expandedNotes}
        setExpandedNotes={setExpandedNotes}
        onToggleTask={(key) => toggleTask(categoryId!, key)}
        onSaveNotes={(key, notes) => setTaskNotes(categoryId!, key, notes)}
        onAddSubtask={(key, title, notes, parentId) => addSubtask(categoryId!, key, title, notes, parentId)}
        onToggleSubtask={(key, subId) => toggleSubtask(categoryId!, key, subId)}
        onRemoveSubtask={(key, subId) => removeSubtask(categoryId!, key, subId)}
        onSetSubtaskNotes={(key, subId, notes) => setSubtaskNotes(categoryId!, key, subId, notes)}
        onRenameSubtask={(key, subId, title) => renameSubtask(categoryId!, key, subId, title)}
        onOpenAddTaskForDay={(week: number, day: string) => { setAddDefaults({ week, day }); setAddOpen(true) }}
        onRenameTask={(key, title) => renameTask(categoryId!, key, title)}
        onRemoveTask={(key) => removeTask(categoryId!, key)}
      />

      {importOpen && (
        <ImportModal
          jsonInput={jsonInput}
          onJsonInput={setJsonInput}
          onClose={() => setImportOpen(false)}
          onImport={() => {
            if (!categoryId) return
            try {
              const parsed = JSON.parse(jsonInput)
              importPlan(categoryId, parsed, null)
              setJsonInput('')
              setImportOpen(false)
            } catch {
              alert('Invalid JSON. Please check and try again.')
            }
          }}
        />
      )}

      {addOpen && categoryId && (
        <AddTaskModal
          initialWeek={addDefaults?.week ?? (() => {
            const now = new Date()
            if (!plan?.startDate) return 1
            const start = new Date(plan.startDate)
            const diffDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000*60*60*24)) + 1)
            return Math.max(1, Math.floor((diffDays - 1) / 7) + 1)
          })()}
          initialDay={addDefaults?.day ?? (() => {
            const now = new Date()
            if (!plan?.startDate) return '1'
            const start = new Date(plan.startDate)
            const diffDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000*60*60*24)) + 1)
            return String(diffDays)
          })()}
          onAdd={(input) => {
            addTask(categoryId, input)
            setAddOpen(false)
            setAddDefaults(null)
          }}
          onClose={() => { setAddOpen(false); setAddDefaults(null) }}
        />
      )}
    </section>
  )
}

type SectionTask = { key: string; title: string; completed: boolean; notes?: string; subtasks?: Subtask[]; isPatternParent?: boolean }
type Section = { id: string; title: string; dayLabel: string; dateLabel: string; dateStart: Date | null; dateEnd: Date | null; tags: string[]; tasks: SectionTask[]; stats: { completed: number; total: number }; week: number; dayRaw: string }

// Count completed/total with rule: only leaf nodes count.
// If a task has subtasks, count only leaf subtasks (ignore non-leaf parents and internal nodes).
// If a task has no subtasks, count the task itself as a single leaf.
function computeStatsWithSubtasks(tasks: SectionTask[]): { completed: number; total: number } {
  let completed = 0
  let total = 0

  function walkSubs(list?: Subtask[]) {
    for (const s of list ?? []) {
      const kids = s.children ?? []
      if (kids.length > 0) {
        walkSubs(kids)
      } else {
        total += 1
        if (s.completed) completed += 1
      }
    }
  }

  for (const t of tasks) {
    const hasSubs = (t.subtasks?.length ?? 0) > 0
    if (hasSubs) {
      walkSubs(t.subtasks)
    } else {
      total += 1
      if (t.completed) completed += 1
    }
  }
  return { completed, total }
}

function SectionsList(props: {
  categoryId: string
  plan: PlanState | null
  mode: ViewMode
  periodLabel: string
  searchQuery: string
  searchTick: number
  selectedTag: string
  expandedNotes: Record<string, boolean>
  setExpandedNotes: (s: Record<string, boolean>) => void
  onToggleTask: (key: string) => void
  onSaveNotes: (key: string, notes: string) => void
  onAddSubtask: (key: string, title: string, notes?: string, parentId?: string) => void
  onToggleSubtask: (key: string, subId: string) => void
  onRemoveSubtask: (key: string, subId: string) => void
  onSetSubtaskNotes: (key: string, subId: string, notes: string) => void
  onRenameSubtask: (key: string, subId: string, title: string) => void
  onOpenAddTaskForDay: (week: number, day: string) => void
  onRenameTask: (key: string, title: string) => void
  onRemoveTask: (key: string) => void
}) {
  const { plan, expandedNotes, setExpandedNotes } = props
  const [addSubFor, setAddSubFor] = useState<{ key: string; parentId?: string } | null>(null)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const [openTaskMenu, setOpenTaskMenu] = useState<string | null>(null)
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({})

  // Close task overflow menu on outside click or Escape
  useEffect(() => {
    if (!openTaskMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.dropdown-menu') || target.closest('.actions-trigger')) return
      setOpenTaskMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenTaskMenu(null)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openTaskMenu])

  function onTileClick(e: React.MouseEvent, key: string) {
    const target = e.target as HTMLElement | null
    if (!target) return
    // Ignore clicks originating from interactive controls or menus
    if (target.closest('input, button, textarea, select, a, .actions-trigger, .dropdown-menu')) return
    setCollapsedTasks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Filter sections by current period
  const visible = useMemo(() => {
    const plan = props.plan
    if (!plan) return []
    return buildSections(props.categoryId, plan)
  }, [props.categoryId, props.plan])

  // Apply tag filter and merge sections for non-day views
  const prepared = useMemo(() => {
    let secs = visible.map(sec => {
      const filteredTasks = sec.tasks.filter(t => {
        if (!props.selectedTag) return true
        const metaTags = plan?.tasks?.[t.key]?.tags ?? []
        if (metaTags.includes(props.selectedTag) || sec.tags.includes(props.selectedTag)) return true
        if (t.isPatternParent) {
          // Check tags on problem tasks represented as subtasks
          for (const st of (t.subtasks ?? [])) {
            const parsed = parseEncodedSubtaskId(st.id)
            if (parsed) {
              const tags = plan?.tasks?.[parsed.problemKey]?.tags ?? []
              if (tags.includes(props.selectedTag)) return true
            }
          }
        }
        return false
      })
      // Search filter
      const q = props.searchQuery?.trim().toLowerCase() ?? ''
      const searched = q
        ? filteredTasks.filter(t => {
            const override = plan?.tasks?.[t.key]?.titleOverride
            const title = (override ?? t.title).toLowerCase()
            const notes = (t.notes ?? '').toLowerCase()
            const subMatch = (t.subtasks ?? []).some(st => st.title.toLowerCase().includes(q))
            return title.includes(q) || notes.includes(q) || subMatch
          })
        : filteredTasks
      const stats = computeStatsWithSubtasks(searched)
      return { ...sec, tasks: searched, stats }
    })

    if (secs.length > 0) {
      if (props.mode === 'week') {
        // Group by plan week; show previous, current, next weeks as separate sections
        const byWeek = new Map<number, Section[]>()
        for (const s of secs) {
          if (!byWeek.has(s.week)) byWeek.set(s.week, [])
          byWeek.get(s.week)!.push(s)
        }
        const grouped: Section[] = []
        for (const [wk, list] of Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0])) {
          const tasks = list.flatMap(x => x.tasks)
          const tags = Array.from(new Set(list.flatMap(x => x.tags)))
          const stats = computeStatsWithSubtasks(tasks)
          const ds = list.map(x => x.dateStart?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const de = list.map(x => x.dateEnd?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const start = ds.length > 0 ? new Date(Math.min(...ds)) : null
          const end = de.length > 0 ? new Date(Math.max(...de)) : null
          // Choose a sample day for header actions (first day in the week)
          const first = list
            .slice()
            .sort((a, b) => (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0))[0]
          grouped.push({
            id: `week-${wk}`,
            title: list[0]?.title ?? `Week ${wk}`,
            dayLabel: 'All days',
            dateLabel: props.periodLabel,
            dateStart: start,
            dateEnd: end,
            tags,
            tasks,
            stats,
            week: first?.week ?? wk,
            dayRaw: first?.dayRaw ?? '1'
          })
        }
        secs = grouped
      } else if (props.mode === 'month') {
        // Group by month-year across the whole plan
        const byMonth = new Map<string, Section[]>()
        for (const s of secs) {
          const d = s.dateStart ?? s.dateEnd
          const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'no-date'
          if (!byMonth.has(key)) byMonth.set(key, [])
          byMonth.get(key)!.push(s)
        }
        const grouped: Section[] = []
        for (const [key, list] of Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0])) ) {
          const tasks = list.flatMap(x => x.tasks)
          const tags = Array.from(new Set(list.flatMap(x => x.tags)))
          const stats = computeStatsWithSubtasks(tasks)
          const ds = list.map(x => x.dateStart?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const de = list.map(x => x.dateEnd?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const start = ds.length > 0 ? new Date(Math.min(...ds)) : null
          const end = de.length > 0 ? new Date(Math.max(...de)) : null
          const first = list
            .slice()
            .sort((a, b) => (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0))[0]
          const dateLabel = props.periodLabel
          // Use Month Year as the title for clarity; dateLabel stays as the view label
          const df = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
          const title = start ? df.format(start) : 'No date'
          grouped.push({
            id: `month-${key}`,
            title,
            dayLabel: 'All days',
            dateLabel,
            dateStart: start,
            dateEnd: end,
            tags,
            tasks,
            stats,
            week: first?.week ?? 0,
            dayRaw: first?.dayRaw ?? '1'
          })
        }
        secs = grouped
      } else if (props.mode === 'quarter') {
        // Group by quarter-year
        const byQ = new Map<string, Section[]>()
        for (const s of secs) {
          const d = s.dateStart ?? s.dateEnd
          const q = d ? Math.floor(d.getMonth() / 3) + 1 : 0
          const key = d ? `${d.getFullYear()}-Q${q}` : 'no-date'
          if (!byQ.has(key)) byQ.set(key, [])
          byQ.get(key)!.push(s)
        }
        const grouped: Section[] = []
        for (const [key, list] of Array.from(byQ.entries()).sort((a, b) => a[0].localeCompare(b[0])) ) {
          const tasks = list.flatMap(x => x.tasks)
          const tags = Array.from(new Set(list.flatMap(x => x.tags)))
          const stats = computeStatsWithSubtasks(tasks)
          const ds = list.map(x => x.dateStart?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const de = list.map(x => x.dateEnd?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const start = ds.length > 0 ? new Date(Math.min(...ds)) : null
          const end = de.length > 0 ? new Date(Math.max(...de)) : null
          const first = list
            .slice()
            .sort((a, b) => (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0))[0]
          grouped.push({
            id: `quarter-${key}`,
            title: key === 'no-date' ? 'No date' : key,
            dayLabel: 'All days',
            dateLabel: props.periodLabel,
            dateStart: start,
            dateEnd: end,
            tags,
            tasks,
            stats,
            week: first?.week ?? 0,
            dayRaw: first?.dayRaw ?? '1'
          })
        }
        secs = grouped
      } else if (props.mode === 'half') {
        // Group by half-year
        const byH = new Map<string, Section[]>()
        for (const s of secs) {
          const d = s.dateStart ?? s.dateEnd
          const h = d ? (d.getMonth() < 6 ? 'H1' : 'H2') : 'H?'
          const key = d ? `${d.getFullYear()}-${h}` : 'no-date'
          if (!byH.has(key)) byH.set(key, [])
          byH.get(key)!.push(s)
        }
        const grouped: Section[] = []
        for (const [key, list] of Array.from(byH.entries()).sort((a, b) => a[0].localeCompare(b[0])) ) {
          const tasks = list.flatMap(x => x.tasks)
          const tags = Array.from(new Set(list.flatMap(x => x.tags)))
          const stats = computeStatsWithSubtasks(tasks)
          const ds = list.map(x => x.dateStart?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const de = list.map(x => x.dateEnd?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const start = ds.length > 0 ? new Date(Math.min(...ds)) : null
          const end = de.length > 0 ? new Date(Math.max(...de)) : null
          const first = list
            .slice()
            .sort((a, b) => (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0))[0]
          grouped.push({
            id: `half-${key}`,
            title: key === 'no-date' ? 'No date' : key.replace('-', ' '),
            dayLabel: 'All days',
            dateLabel: props.periodLabel,
            dateStart: start,
            dateEnd: end,
            tags,
            tasks,
            stats,
            week: first?.week ?? 0,
            dayRaw: first?.dayRaw ?? '1'
          })
        }
        secs = grouped
      } else if (props.mode === 'year') {
        // Group by year
        const byY = new Map<string, Section[]>()
        for (const s of secs) {
          const d = s.dateStart ?? s.dateEnd
          const key = d ? String(d.getFullYear()) : 'no-date'
          if (!byY.has(key)) byY.set(key, [])
          byY.get(key)!.push(s)
        }
        const grouped: Section[] = []
        for (const [key, list] of Array.from(byY.entries()).sort((a, b) => a[0].localeCompare(b[0])) ) {
          const tasks = list.flatMap(x => x.tasks)
          const tags = Array.from(new Set(list.flatMap(x => x.tags)))
          const stats = computeStatsWithSubtasks(tasks)
          const ds = list.map(x => x.dateStart?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const de = list.map(x => x.dateEnd?.getTime()).filter((n): n is number => Number.isFinite(n as number))
          const start = ds.length > 0 ? new Date(Math.min(...ds)) : null
          const end = de.length > 0 ? new Date(Math.max(...de)) : null
          const first = list
            .slice()
            .sort((a, b) => (a.dateStart?.getTime() ?? 0) - (b.dateStart?.getTime() ?? 0))[0]
          grouped.push({
            id: `year-${key}`,
            title: key === 'no-date' ? 'No date' : key,
            dayLabel: 'All days',
            dateLabel: props.periodLabel,
            dateStart: start,
            dateEnd: end,
            tags,
            tasks,
            stats,
            week: first?.week ?? 0,
            dayRaw: first?.dayRaw ?? '1'
          })
        }
        secs = grouped
      }
    }
    // If filters are active, hide sections that ended up with zero tasks
    const filtersActive = (props.selectedTag && props.selectedTag.length > 0) || (props.searchQuery && props.searchQuery.trim().length > 0)
    if (filtersActive) {
      secs = secs.filter(s => s.tasks.length > 0)
    }
    return secs
  }, [visible, plan, props.selectedTag, props.mode, props.periodLabel, props.searchQuery])

  // Search: on tick, find first matching task and scroll+highlight
  useEffect(() => {
    if (!props.searchQuery) return
    const q = props.searchQuery.toLowerCase().trim()
    for (const sec of prepared) {
      for (const t of sec.tasks) {
        const title = (plan?.tasks?.[t.key]?.titleOverride ?? t.title).toLowerCase()
        const notes = (t.notes ?? '').toLowerCase()
        const subMatch = (t.subtasks ?? []).some(st => st.title.toLowerCase().includes(q))
        if (title.includes(q) || notes.includes(q) || subMatch) {
          setHighlightKey(t.key)
          // Defer to next tick to ensure element exists
          setTimeout(() => {
            const el = document.getElementById(`task-${t.key}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
          return
        }
      }
    }
  }, [props.searchTick])

  return (
    <div className="column" style={{ gap: 12 }}>
      {prepared.length === 0 ? (
        <p className="muted">{(props.selectedTag && props.selectedTag.length > 0) || (props.searchQuery && props.searchQuery.trim().length > 0) ? 'No tasks match your filters.' : 'No tasks yet for this plan. Use Import Plan to add tasks.'}</p>
      ) : prepared.map((sec) => (
        <article key={sec.id} className="card" style={{ padding: 16 }}>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div className="column" style={{ gap: 4, minWidth: 0 }}>
              <div className="tile-title" style={{ fontSize: '1.05rem' }}>{props.mode === 'day' ? sec.dayLabel : sec.title}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="muted">{sec.dayLabel} · {sec.dateLabel}</span>
                {sec.tags.map((t) => (
                  <span key={t} className="btn-ghost btn-pill" style={{ padding: '2px 8px', fontSize: 12 }}>{t}</span>
                ))}
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="tile-sub">{sec.stats.completed}/{sec.stats.total} done</div>
              <button
                className="btn-ghost btn-icon btn-icon-lg"
                aria-label="Add task for this day"
                title="Add task for this day"
                onClick={() => props.onOpenAddTaskForDay(sec.week, sec.dayRaw)}
              >
                <SquarePlus size={22} />
              </button>
            </div>
          </div>

          {sec.tasks.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>No tasks yet for this section.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sec.tasks.map((t) => (
                <li
                  key={t.key}
                  id={`task-${t.key}`}
                  className="tile"
                  data-menu-open={openTaskMenu === t.key ? 'true' : undefined}
                  data-collapsed={collapsedTasks[t.key] ? 'true' : undefined}
                  style={{ alignItems: 'flex-start', gap: 10, paddingRight: 16, outline: highlightKey === t.key ? '2px solid var(--primary)' : 'none', borderRadius: 8 }}
                  onClick={(e) => onTileClick(e, t.key)}
                >
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => props.onToggleTask(t.key)}
                    aria-label={`Mark ${t.title} as ${t.completed ? 'incomplete' : 'complete'}`}
                  />
                  <div className="column" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ alignItems: 'center' }}>
                      <div className="tile-title" style={{ fontWeight: 600 }}>{props.plan?.tasks?.[t.key]?.titleOverride ?? t.title}</div>
                      <div className="row task-actions" style={{ gap: 6, position: 'relative' }}>
                        <div className="row inline-actions" style={{ gap: 6 }}>
                          <button
                            className="btn-ghost btn-sm"
                            aria-label={expandedNotes[t.key] ? 'Hide notes' : 'Show notes'}
                            title={expandedNotes[t.key] ? 'Hide notes' : 'Show notes'}
                            onClick={() => setExpandedNotes({ ...expandedNotes, [t.key]: !expandedNotes[t.key] })}
                          >
                            <StickyNote size={16} />
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            aria-label="Add subtask"
                            title="Add subtask"
                            onClick={() => {
                              if (t.isPatternParent) {
                                // Adding under a pattern creates a new Problem task for this day
                                props.onOpenAddTaskForDay(sec.week, sec.dayRaw)
                              } else {
                                setAddSubFor({ key: t.key })
                              }
                            }}
                          >
                            <CornerDownRight size={16} />
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            aria-label="Rename task"
                            title="Rename task"
                            onClick={() => {
                              const currentName = props.plan?.tasks?.[t.key]?.titleOverride ?? t.title
                              const v = prompt('Rename task', currentName)
                              if (v && v.trim()) props.onRenameTask(t.key, v.trim())
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn-ghost btn-sm"
                            aria-label="Delete task"
                            title="Delete task"
                            onClick={() => {
                              const currentName = props.plan?.tasks?.[t.key]?.titleOverride ?? t.title
                              if (confirm(`Delete task “${currentName}”? This cannot be undone.`)) {
                                props.onRemoveTask(t.key)
                              }
                            }}
                            style={{ color: '#dc2626' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div>
                          <button
                            className="btn-ghost btn-sm actions-trigger"
                            aria-haspopup="menu"
                            aria-expanded={openTaskMenu === t.key}
                            aria-label="More actions"
                            title="More actions"
                            onClick={() => setOpenTaskMenu(openTaskMenu === t.key ? null : t.key)}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openTaskMenu === t.key && (
                            <div role="menu" className="dropdown-menu">
                              <button role="menuitem" className="menu-item" onClick={() => { setExpandedNotes({ ...expandedNotes, [t.key]: !expandedNotes[t.key] }); setOpenTaskMenu(null) }}>
                                <StickyNote size={16} aria-hidden="true" />
                                <span>{expandedNotes[t.key] ? 'Hide notes' : 'Show notes'}</span>
                              </button>
                              <button role="menuitem" className="menu-item" onClick={() => {
                                if (t.isPatternParent) {
                                  props.onOpenAddTaskForDay(sec.week, sec.dayRaw)
                                } else {
                                  setAddSubFor({ key: t.key })
                                }
                                setOpenTaskMenu(null)
                              }}>
                                <CornerDownRight size={16} aria-hidden="true" />
                                <span>Add subtask</span>
                              </button>
                              <button role="menuitem" className="menu-item" onClick={() => {
                                const currentName = props.plan?.tasks?.[t.key]?.titleOverride ?? t.title
                                const v = prompt('Rename task', currentName)
                                if (v && v.trim()) props.onRenameTask(t.key, v.trim())
                                setOpenTaskMenu(null)
                              }}>
                                <Pencil size={16} aria-hidden="true" />
                                <span>Rename task</span>
                              </button>
                              <button role="menuitem" className="menu-item danger" onClick={() => {
                                const currentName = props.plan?.tasks?.[t.key]?.titleOverride ?? t.title
                                if (confirm(`Delete task “${currentName}”? This cannot be undone.`)) {
                                  props.onRemoveTask(t.key)
                                }
                                setOpenTaskMenu(null)
                              }}>
                                <Trash2 size={16} aria-hidden="true" />
                                <span>Delete task</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!collapsedTasks[t.key] && expandedNotes[t.key] && (
                      <div className="column" style={{ gap: 6 }}>
                        <textarea
                          defaultValue={t.notes ?? ''}
                          placeholder="Add links or description..."
                          onBlur={(e) => props.onSaveNotes(t.key, e.target.value)}
                          style={{ width: '100%', minHeight: 64, resize: 'vertical' }}
                        />
                      </div>
                    )}
                    {!collapsedTasks[t.key] && (
                      <Subtasks
                        subtasks={t.subtasks ?? []}
                        onOpenAddSubtask={(opts) => {
                          if (!t.isPatternParent) {
                            setAddSubFor({ key: t.key, parentId: opts?.parentId })
                            return
                          }
                          const pid = opts?.parentId
                          if (!pid) return
                          const parsed = parseEncodedSubtaskId(pid)
                          if (!parsed) return
                          // Add under the appropriate problem task
                          setAddSubFor({ key: parsed.problemKey, parentId: parsed.subId })
                        }}
                        onToggle={(id) => {
                          if (!t.isPatternParent) {
                            props.onToggleSubtask(t.key, id)
                            return
                          }
                          const parsed = parseEncodedSubtaskId(id)
                          if (!parsed) return
                          if (parsed.subId) props.onToggleSubtask(parsed.problemKey, parsed.subId)
                          else props.onToggleTask(parsed.problemKey)
                        }}
                        onRemove={(id) => {
                          if (!t.isPatternParent) {
                            props.onRemoveSubtask(t.key, id)
                            return
                          }
                          const parsed = parseEncodedSubtaskId(id)
                          if (!parsed) return
                          if (parsed.subId) props.onRemoveSubtask(parsed.problemKey, parsed.subId)
                          else props.onRemoveTask(parsed.problemKey)
                        }}
                        onSetNotes={(subId, notes) => {
                          if (!t.isPatternParent) {
                            props.onSetSubtaskNotes(t.key, subId, notes)
                            return
                          }
                          const parsed = parseEncodedSubtaskId(subId)
                          if (!parsed) return
                          if (parsed.subId) props.onSetSubtaskNotes(parsed.problemKey, parsed.subId, notes)
                          else props.onSaveNotes(parsed.problemKey, notes)
                        }}
                        onRename={(subId, title) => {
                          if (!t.isPatternParent) {
                            props.onRenameSubtask(t.key, subId, title)
                            return
                          }
                          const parsed = parseEncodedSubtaskId(subId)
                          if (!parsed) return
                          if (parsed.subId) props.onRenameSubtask(parsed.problemKey, parsed.subId, title)
                          else props.onRenameTask(parsed.problemKey, title)
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {addSubFor && (
            <AddSubtaskModal
              onAdd={(title, notes) => { props.onAddSubtask(addSubFor.key, title, notes, addSubFor.parentId); setAddSubFor(null) }}
              onClose={() => setAddSubFor(null)}
            />
          )}
        </article>
      ))}
    </div>
  )
}

function Subtasks({ subtasks, onOpenAddSubtask, onToggle, onRemove, onSetNotes, onRename }: {
  subtasks: { id: string; title: string; completed?: boolean; notes?: string; children?: Subtask[] }[]
  onOpenAddSubtask: (opts?: { parentId?: string }) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onSetNotes: (id: string, notes: string) => void
  onRename: (id: string, title: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  // Close subtask overflow menu on outside click or Escape
  useEffect(() => {
    if (!openMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.dropdown-menu') || target.closest('.actions-trigger')) return
      setOpenMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  function Item({ s }: { s: Subtask }) {
    return (
      <li className="column" style={{ gap: 6 }}>
        <div className="row" style={{ alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <label className="row" style={{ gap: 8, alignItems: 'center', minWidth: 0 }}>
            <input type="checkbox" checked={!!s.completed} onChange={() => onToggle(s.id)} />
            <span className="tile-sub" style={{ textDecoration: s.completed ? 'line-through' : 'none' }}>{s.title}</span>
          </label>
          <div className="row subtask-actions" style={{ gap: 6, position: 'relative' }}>
            <div className="row inline-actions" style={{ gap: 6 }}>
              <button
                className="btn-ghost btn-sm"
                aria-label={expanded[s.id] ? 'Hide notes' : 'Show notes'}
                title={expanded[s.id] ? 'Hide notes' : 'Show notes'}
                onClick={() => setExpanded({ ...expanded, [s.id]: !expanded[s.id] })}
              >
                <StickyNote size={16} />
              </button>
              <button
                className="btn-ghost btn-sm"
                aria-label="Add child subtask"
                title="Add child subtask"
                onClick={() => onOpenAddSubtask({ parentId: s.id })}
              >
                <CornerDownRight size={16} />
              </button>
              <button
                className="btn-ghost btn-sm"
                aria-label="Rename subtask"
                title="Rename subtask"
                onClick={() => {
                  const t = prompt('Rename subtask', s.title)
                  if (t && t.trim()) onRename(s.id, t.trim())
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn-ghost btn-sm"
                aria-label="Remove subtask"
                title="Remove subtask"
                onClick={() => onRemove(s.id)}
                style={{ color: '#dc2626' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div>
              <button
                className="btn-ghost btn-sm actions-trigger"
                aria-haspopup="menu"
                aria-expanded={openMenu === s.id}
                aria-label="More actions"
                title="More actions"
                onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === s.id && (
                <div role="menu" className="dropdown-menu">
                  <button role="menuitem" className="menu-item" onClick={() => { setExpanded({ ...expanded, [s.id]: !expanded[s.id] }); setOpenMenu(null) }}>
                    <StickyNote size={16} aria-hidden="true" />
                    <span>{expanded[s.id] ? 'Hide notes' : 'Show notes'}</span>
                  </button>
                  <button role="menuitem" className="menu-item" onClick={() => { onOpenAddSubtask({ parentId: s.id }); setOpenMenu(null) }}>
                    <CornerDownRight size={16} aria-hidden="true" />
                    <span>Add child subtask</span>
                  </button>
                  <button role="menuitem" className="menu-item" onClick={() => {
                    const t = prompt('Rename subtask', s.title)
                    if (t && t.trim()) onRename(s.id, t.trim())
                    setOpenMenu(null)
                  }}>
                    <Pencil size={16} aria-hidden="true" />
                    <span>Rename subtask</span>
                  </button>
                  <button role="menuitem" className="menu-item danger" onClick={() => { onRemove(s.id); setOpenMenu(null) }}>
                    <Trash2 size={16} aria-hidden="true" />
                    <span>Remove subtask</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {expanded[s.id] && (
          <textarea
            defaultValue={s.notes ?? ''}
            placeholder="Subtask notes..."
            onBlur={(e) => onSetNotes(s.id, e.target.value)}
            style={{ width: '100%', minHeight: 56, resize: 'vertical' }}
          />
        )}
        {s.children && s.children.length > 0 && (
          <ul style={{ listStyle: 'none', paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.children.map(child => (
              <Item key={child.id} s={child} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="column" style={{ gap: 8 }}>
      {subtasks.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {subtasks.map(s => (
            <Item key={s.id} s={s as Subtask} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ImportModal(props: { jsonInput: string; onJsonInput: (v: string) => void; onImport: () => void; onClose: () => void }) {
  const { jsonInput, onJsonInput, onImport, onClose } = props
  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'color-mix(in oklab, var(--background) 70%, black 40%)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <article className="card" style={{ width: 'min(820px, 96vw)', maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: 8 }}>
          <div className="tile-title">Import Plan</div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="column" style={{ gap: 10 }}>
          <div className="column" style={{ gap: 6 }}>
            <label className="tile-sub">Plan JSON</label>
            <textarea
              placeholder="Paste plan JSON here"
              value={jsonInput}
              onChange={(e) => onJsonInput(e.target.value)}
              style={{ width: '100%', minHeight: 220, resize: 'vertical' }}
            />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onImport}>Import</button>
          </div>
        </div>
      </article>
    </div>
  )
}

function AddSubtaskModal(props: { onAdd: (title: string, notes?: string) => void; onClose: () => void }) {
  const { onAdd, onClose } = props
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const canAdd = title.trim().length > 0
  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'color-mix(in oklab, var(--background) 70%, black 40%)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <article className="card" style={{ width: 'min(620px, 96vw)', maxWidth: 620 }}>
        <header className="row between" style={{ alignItems: 'center', padding: 16 }}>
          <h3 style={{ margin: 0 }}>Add Subtask</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="column" style={{ gap: 12, padding: 16 }}>
          <label className="column" style={{ gap: 6 }}>
            <span className="tile-sub">Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Subtask title" />
          </label>
          <label className="column" style={{ gap: 6 }}>
            <span className="tile-sub">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" style={{ minHeight: 100, resize: 'vertical' }} />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!canAdd} onClick={() => { onAdd(title.trim(), notes.trim() || undefined); onClose() }}>Add</button>
          </div>
        </div>
      </article>
    </div>
  )
}

function AddTaskModal(props: { initialWeek: number; initialDay: string; onAdd: (input: { week: number; day: string; kind: 'activity' | 'problem'; title: string; patternName?: string }) => void; onClose: () => void }) {
  const { initialWeek, initialDay, onAdd, onClose } = props
  const [week, setWeek] = useState<number>(initialWeek)
  const [day, setDay] = useState<string>(initialDay)
  const [kind, setKind] = useState<'activity' | 'problem'>('activity')
  const [title, setTitle] = useState<string>('')
  const [patternName, setPatternName] = useState<string>('')
  const canAdd = title.trim().length > 0 && week > 0 && day.trim().length > 0
  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'color-mix(in oklab, var(--background) 70%, black 40%)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <article className="card" style={{ width: 'min(720px, 96vw)', maxWidth: 720 }}>
        <header className="row between" style={{ alignItems: 'center', padding: 16 }}>
          <h3 style={{ margin: 0 }}>Add Task</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="column" style={{ gap: 12, padding: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <label className="column" style={{ gap: 6, flex: 1 }}>
              <span className="tile-sub">Week</span>
              <input type="number" min={1} value={week} onChange={(e) => setWeek(parseInt(e.target.value || '1', 10))} />
            </label>
            <label className="column" style={{ gap: 6, flex: 1 }}>
              <span className="tile-sub">Day</span>
              <input type="text" value={day} onChange={(e) => setDay(e.target.value)} placeholder="e.g. 1 or 3-4" />
            </label>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label className="column" style={{ gap: 6, flex: 1 }}>
              <span className="tile-sub">Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as 'activity' | 'problem')}>
                <option value="activity">Activity</option>
                <option value="problem">Problem (pattern)</option>
              </select>
            </label>
            {kind === 'problem' && (
              <label className="column" style={{ gap: 6, flex: 1 }}>
                <span className="tile-sub">Pattern</span>
                <input type="text" value={patternName} onChange={(e) => setPatternName(e.target.value)} placeholder="e.g. Two Pointers" />
              </label>
            )}
          </div>
          <label className="column" style={{ gap: 6 }}>
            <span className="tile-sub">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'activity' ? 'Activity name' : 'Problem title'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canAdd) {
                  onAdd({ week, day, kind, title: title.trim(), patternName: patternName.trim() || undefined })
                }
              }}
            />
            {title.trim().length === 0 && (
              <span className="muted" style={{ fontSize: 12 }}>Enter a title to enable Add.</span>
            )}
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!canAdd} onClick={() => onAdd({ week, day, kind, title: title.trim(), patternName: patternName.trim() || undefined })}>Add</button>
          </div>
        </div>
      </article>
    </div>
  )
}

// Encode/decode helpers to route subtask actions of pattern parents to the
// underlying problem task keys. Format: `k|<problemKey>` for the root problem node,
// and `k|<problemKey>#<subId>` for nested subtasks under that problem.
function encodeProblemRootId(problemKey: string): string { return `k|${problemKey}` }
function encodeProblemSubId(problemKey: string, subId: string): string { return `k|${problemKey}#${subId}` }
function parseEncodedSubtaskId(id: string): { problemKey: string; subId?: string } | null {
  if (!id.startsWith('k|')) return null
  const rest = id.slice(2)
  const hash = rest.indexOf('#')
  if (hash === -1) return { problemKey: rest }
  return { problemKey: rest.slice(0, hash), subId: rest.slice(hash + 1) }
}

// Build sections from plan
function buildSections(categoryId: string, plan: PlanState): Section[] {
  const sections: Section[] = []
  const startISO: string | null = plan.startDate
  const start = startISO ? new Date(startISO) : null
  const tasksState: Record<string, TaskMeta> = plan.tasks ?? {}
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

  for (const wk of plan.raw?.schedule ?? []) {
    for (const day of wk.days ?? []) {
      const { startDay, endDay } = parseDayRange(day.day)
      const dateLabel = !start
        ? 'No start date'
        : startDay === endDay
          ? fmt.format(addDays(start, startDay - 1))
          : `${fmt.format(addDays(start, startDay - 1))} - ${fmt.format(addDays(start, endDay - 1))}`
      const dateStart = start ? addDays(start, startDay - 1) : null
      const dateEnd = start ? addDays(start, endDay - 1) : null
      const dayLabel = startDay === endDay ? `Day ${startDay}` : `Days ${startDay}-${endDay}`
      const tags = new Set<string>()
      const tasks: SectionTask[] = []

      if (day.patterns) {
        for (const p of day.patterns) {
          if (p?.name) tags.add(p.name)

          // Build a synthesized parent task for the pattern, nesting each problem as a subtask.
          const problemNodes: Subtask[] = []
          for (const pr of p.problems ?? []) {
            const problemKey = makeTaskKey(categoryId, wk.week, day.day, p.name ?? 'pattern', pr)
            const problemMeta = tasksState[problemKey] ?? {}

            function mapChildren(list?: Subtask[]): Subtask[] | undefined {
              if (!list || list.length === 0) return undefined
              return list.map(child => ({
                id: encodeProblemSubId(problemKey, child.id),
                title: child.title,
                completed: child.completed,
                notes: child.notes,
                children: mapChildren(child.children)
              }))
            }

            problemNodes.push({
              id: encodeProblemRootId(problemKey),
              title: problemMeta.titleOverride ?? pr,
              completed: !!problemMeta.completed,
              notes: problemMeta.notes,
              children: mapChildren(problemMeta.subtasks)
            })
          }

          const parentKey = makeTaskKey(categoryId, wk.week, day.day, 'pattern', p?.name ?? 'Pattern')
          const parentMeta = tasksState[parentKey] ?? {}
          tasks.push({
            key: parentKey,
            title: p?.name ?? 'Pattern',
            completed: !!parentMeta.completed,
            notes: parentMeta.notes,
            subtasks: problemNodes,
            isPatternParent: true
          })
        }
      }
      if (day.activities) {
        for (const act of day.activities) {
          const key = makeTaskKey(categoryId, wk.week, day.day, 'activity', act)
          const meta = tasksState[key] ?? {}
          tasks.push({ key, title: act, completed: !!meta.completed, notes: meta.notes, subtasks: meta.subtasks })
        }
      }

      const stats = computeStatsWithSubtasks(tasks)
      const title = wk.topic ? `${wk.topic}` : `Week ${wk.week}`
      sections.push({ id: `${wk.week}-${day.day}`, title, dayLabel, dateLabel, dateStart, dateEnd, tags: Array.from(tags), tasks, stats, week: wk.week, dayRaw: day.day })
    }
  }

  return sections
}

function parseDayRange(s: string): { startDay: number; endDay: number } {
  const parts = String(s).split('-').map(n => parseInt(n.trim(), 10)).filter(n => !Number.isNaN(n))
  if (parts.length === 0) return { startDay: 1, endDay: 1 }
  if (parts.length === 1) return { startDay: parts[0], endDay: parts[0] }
  return { startDay: parts[0], endDay: parts[1] }
}

function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function makeTaskKey(categoryId: string, week: number, day: string, bucket: string, title: string): string {
  return `${categoryId}__w${week}__d${day}__${slug(bucket)}__${slug(title)}`
}

// removed todayInput used previously for import start date selection
