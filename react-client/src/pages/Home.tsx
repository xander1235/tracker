import CategoryForm from '@/components/CategoryForm'
import ImportCategories from '@/components/ImportCategories'
import CategoryTile from '@/components/CategoryTile'
import { useCategories } from '@/store/CategoriesProvider'
import { useState, useMemo } from 'react'
import { Trash2 } from 'lucide-react'

export default function Home() {
  const { categories, clearAll, removeCategory } = useCategories()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mobileFormsOpen, setMobileFormsOpen] = useState(false)

  const selectedCount = selected.size
  const hasAny = categories.length > 0

  function toggleSelectMode() {
    setSelecting((v) => {
      if (v) setSelected(new Set())
      return !v
    })
  }

  function onToggle(id: string, next: boolean) {
    setSelected((prev) => {
      const s = new Set(prev)
      if (next) s.add(id)
      else s.delete(id)
      return s
    })
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  return (
    <section>
      <h1>Home</h1>
      <div className="page two-col">
        <aside className="sidebar column" data-open={mobileFormsOpen} style={{ gap: 16 }}>
          <CategoryForm />
          <ImportCategories />
        </aside>
        <section className="main">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>All</span>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn-primary btn-pill btn-md show-mobile"
                onClick={() => setMobileFormsOpen((v) => !v)}
              >
                {mobileFormsOpen ? 'Hide' : 'New'}
              </button>
              {hasAny && (
                <>
                  <button type="button" className="btn-ghost" onClick={toggleSelectMode}>
                    {selecting ? 'Done' : 'Select'}
                  </button>
                  {selecting && selectedCount > 0 && (
                    <button
                      type="button"
                      className="danger btn-icon btn-icon-lg has-badge"
                      onClick={() => {
                        selectedIds.forEach((id) => removeCategory(id))
                        setSelected(new Set())
                      }}
                      aria-label={`Delete ${selectedCount} selected`}
                      title={`Delete ${selectedCount} selected`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                      <span className="count-badge" aria-hidden="true">{selectedCount}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger btn-icon btn-icon-lg"
                    onClick={clearAll}
                    aria-label="Clear all plans"
                    title="Clear all plans"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
          {categories.length === 0 ? (
            <p className="muted">No plans yet. Create one or import from JSON.</p>
          ) : (
            <div className="grid">
              {categories.map((c) => (
                <CategoryTile
                  key={c.id}
                  category={c}
                  selecting={selecting}
                  selected={selected.has(c.id)}
                  onToggleSelect={(id: string, next: boolean) => onToggle(id, next)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
