import type { Category } from '@/types/category'
import { useCategories } from '@/store/CategoriesProvider'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/store/TasksProvider'

type Props = {
  category: Category
  selecting?: boolean
  selected?: boolean
  onToggleSelect?: (id: string, next: boolean) => void
}

export default function CategoryTile({ category, selecting = false, selected = false, onToggleSelect }: Props) {
  const { removeCategory } = useCategories()
  const { isStarted, getProgress, start } = useTasks()
  const navigate = useNavigate()
  const started = isStarted(category.id)
  const { completed, total } = getProgress(category.id)

  return (
    <article className={`tile${selecting ? ' has-check' : ''}`} title={category.name}>
      {selecting && (
        <label className="tile-check">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect?.(category.id, e.target.checked)}
            aria-label={`Select ${category.name}`}
          />
        </label>
      )}

      <button
        type="button"
        className="btn-ghost-danger btn-icon btn-icon-lg tile-del"
        onClick={() => removeCategory(category.id)}
        aria-label={`Remove ${category.name}`}
        title="Remove"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>

      <div
        className="tile-left"
        role="button"
        tabIndex={0}
        onClick={() => { if (!selecting) navigate(`/tasks/${category.id}`) }}
        onKeyDown={(e) => { if (!selecting && (e.key === 'Enter' || e.key === ' ')) navigate(`/tasks/${category.id}`) }}
        style={{ cursor: 'pointer' }}
      >
        <div className="tile-title">{category.name}</div>
        <div className="tile-sub text-success">{completed}/{total} tasks</div>
        <div className="tile-cta">
          <button
            type="button"
            className="btn-primary btn-pill btn-md"
            onClick={() => {
              if (!started) start(category.id)
              navigate(`/tasks/${category.id}`)
            }}
            aria-label={started ? `Open ${category.name}` : `Start ${category.name}`}
          >
            {started ? 'Open' : 'Start'}
          </button>
        </div>
      </div>
    </article>
  )
}
