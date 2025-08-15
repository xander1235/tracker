import { useState } from 'react'
import { useCategories } from '@/store/CategoriesProvider'
import { useTasks } from '@/store/TasksProvider'

type PlanInput = {
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

export default function ImportCategories() {
  const { importCategories, categories } = useCategories()
  const [result, setResult] = useState<string>('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [fileJson, setFileJson] = useState<PlanInput | null>(null)
  const [useText, setUseText] = useState(false)
  const { importPlan } = useTasks()

  function genId() {
    try {
      // @ts-ignore
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        // @ts-ignore
        return crypto.randomUUID()
      }
    } catch {}
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function normalizePlanInput(input: unknown): PlanInput | null {
    const pick = (obj: any): PlanInput | null => {
      if (!obj || typeof obj !== 'object') return null
      const schedule = Array.isArray(obj.schedule) ? obj.schedule : []
      if (schedule.length === 0) return null
      const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title : 'Imported Plan'
      return { title, schedule: schedule as any }
    }
    if (Array.isArray(input)) {
      if (input.length === 0) return null
      return pick(input[0])
    }
    return pick(input as any)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const json = normalizePlanInput(parsed)
        if (!json) {
          setFileJson(null)
          setResult('Invalid Plan JSON: expected an object or array with non-empty schedule')
          return
        }
        setFileJson(json)
        setResult('Loaded JSON from file. Ready to import.')
      } catch {
        setFileJson(null)
        setResult('Invalid JSON file')
      }
    }
    reader.readAsText(f)
  }

  function handlePasteImport() {
    try {
      const parsed = JSON.parse(text)
      const json = normalizePlanInput(parsed)
      if (!json) {
        setFileJson(null)
        setResult('Invalid Plan JSON: expected an object or array with non-empty schedule')
        return
      }
      setFileJson(json)
      setResult('Loaded JSON from text. Ready to import.')
    } catch {
      setFileJson(null)
      setResult('Invalid JSON text')
    }
  }

  function doImport() {
    const nm = name.trim()
    if (!nm) {
      setResult('Provide a plan name')
      return
    }
    if (!fileJson) {
      setResult('Load or paste a valid Plan JSON')
      return
    }
    const id = genId()
    const res = importCategories({ id, name: nm })
    const targetId = res.imported > 0 ? id : (categories.find(c => c.name.toLowerCase() === nm.toLowerCase())?.id)
    if (targetId) {
      try {
        importPlan(targetId, fileJson, null)
        setResult(res.imported > 0 ? 'Imported plan' : 'Plan imported into existing entry')
      } catch {
        setResult('Failed to import plan')
      }
      setName('')
      setText('')
      setFileJson(null)
    } else {
      setResult('Plan import skipped')
    }
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Import Plan</h2>
      <div className="form">
        <div className="form-item">
          <label htmlFor="imp-name" className="label">Name</label>
          <div className="input-wrap">
            <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7l-8 4-8-4"/>
              <path d="M4 7v10l8 4 8-4V7"/>
            </svg>
            <input
              id="imp-name"
              className="input has-icon"
              type="text"
              placeholder="Plan name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-item">
          <label className="label">Plan JSON Source</label>
          {useText ? (
            <>
              <textarea
                className="input"
                placeholder='Paste Plan JSON (tasks schedule, patterns, activities). Name field above will be used for the plan.'
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
              />
              <div className="row between">
                <button type="button" className="btn-primary" onClick={handlePasteImport}>Load Plan JSON</button>
                <button type="button" className="btn-ghost" onClick={() => setUseText(false)}>Use file instead</button>
              </div>
            </>
          ) : (
            <div className="row between" style={{ alignItems: 'center' }}>
              <input type="file" accept="application/json,.json" onChange={handleFile} />
              <button type="button" className="btn-ghost" onClick={() => setUseText(true)}>Paste JSON</button>
            </div>
          )}
          <div className="small muted">Load or paste the Plan JSON. We will create the plan and import its tasks.</div>
        </div>

        {result && <p className="small" role="status">{result}</p>}
        <button type="button" className="btn-primary" onClick={doImport}>Import</button>
      </div>
    </section>
  )
}
