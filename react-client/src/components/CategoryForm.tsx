import type { FormEvent } from 'react'
import { useState } from 'react'
import { useCategories } from '@/store/CategoriesProvider'

export default function CategoryForm() {
  const { addCategory } = useCategories()
  const [name, setName] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const before = name
    addCategory(name)
    if (before.trim()) {
      setFeedback(`Added: ${before.trim()}`)
      setName('')
    }
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Create Plan</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="form-item">
          <label htmlFor="cat-name" className="label">Name</label>
          <div className="input-wrap">
            <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7l-8 4-8-4"/>
              <path d="M4 7v10l8 4 8-4V7"/>
            </svg>
            <input
              id="cat-name"
              className="input has-icon"
              type="text"
              placeholder="Plan name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        {feedback && <p className="small" role="status">{feedback}</p>}
        <button type="submit" className="btn-primary">Add Plan</button>
      </form>
    </section>
  )
}
