import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

// Match frontend slug and key logic exactly
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function makeTaskKey(categoryId, week, day, bucket, title) {
  return `${categoryId}__w${week}__d${day}__${slug(bucket)}__${slug(title)}`
}
ensureDir(dataDir)

function readJSON(file, fallback) {
  try {
    const p = path.join(dataDir, file)
    if (!fs.existsSync(p)) return fallback
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

function writeJSON(file, obj) {
  const p = path.join(dataDir, file)
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8')
}

// Return "YYYY-MM-DD" for tomorrow in server local time
function getTomorrowISODate() {
  const now = new Date()
  now.setDate(now.getDate() + 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Seed plan loader (local JSON mode)
function loadSeedPlan() {
  try {
    // Prefer the new comprehensive seed file if present
    const newSeedPath = path.join(__dirname, 'seed', 'plan-dsa-sde3-backend.json')
    if (fs.existsSync(newSeedPath)) {
      const rawNew = fs.readFileSync(newSeedPath, 'utf8')
      const parsed = JSON.parse(rawNew)
      // Normalize shape: unwrap first entry from plans[] if available
      if (parsed && Array.isArray(parsed.plans) && parsed.plans.length > 0) {
        return parsed.plans[0]
      }
      return parsed
    }

    // Fallback to legacy seed file
    const legacySeedPath = path.join(__dirname, 'seed', 'plan-sde3-backend.json')
    if (!fs.existsSync(legacySeedPath)) return null
    const rawLegacy = fs.readFileSync(legacySeedPath, 'utf8')
    return JSON.parse(rawLegacy)
  } catch {
    return null
  }
}

// Files
// users.json: [{ id, email, name, passwordHash }]
// categories.json: { [userId]: Category[] }
// plans.json: { [userId]: { [categoryId]: { title, startDate, raw } } }
// tasks.json: { [userId]: { started: Record<string, boolean>, progress: Record<string, {completed,total}>, tasks: { [categoryId]: Record<TaskKey, TaskMeta> } } }

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/health', (req, res) => res.json({ ok: true }))

// Auth
app.post('/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const users = readJSON('users.json', [])
  const exists = users.find(u => u.email.toLowerCase() === String(email).toLowerCase())
  if (exists) return res.status(409).json({ error: 'User already exists' })
  const id = nanoid()
  const passwordHash = bcrypt.hashSync(password, 10)
  const user = { id, name: name || '', email, passwordHash }
  users.push(user)
  writeJSON('users.json', users)
  res.json({ id, name: user.name, email: user.email })
})

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const users = readJSON('users.json', [])
  const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase())
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = bcrypt.compareSync(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  res.json({ id: user.id, name: user.name, email: user.email })
})

// Categories
app.get('/categories', (req, res) => {
  const userId = String(req.query.userId || '')
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const all = readJSON('categories.json', {})
  let list = Array.isArray(all[userId]) ? all[userId] : []

  // Auto-seed default category and plan for new users (local JSON mode only)
  if (list.length === 0) {
    const seed = loadSeedPlan()
    if (seed) {
      const catId = 'sde3-backend-prep'
      const category = { id: catId, name: 'SDE3 Backend Prep', color: '#2563eb' }
      list = [category]
      all[userId] = list
      writeJSON('categories.json', all)

      // Ensure plans.json has the seed plan for this category
      const plansByUser = readJSON('plans.json', {})
      const userPlans = typeof plansByUser[userId] === 'object' && plansByUser[userId] ? { ...plansByUser[userId] } : {}
      if (!userPlans[catId]) {
        userPlans[catId] = { title: seed.title || 'SDE3 Backend Prep', startDate: getTomorrowISODate(), raw: seed }
        plansByUser[userId] = userPlans
        writeJSON('plans.json', plansByUser)
      }
    }
  }

  res.json(list)
})

app.put('/categories', (req, res) => {
  const { userId, categories } = req.body || {}
  if (!userId || !Array.isArray(categories)) return res.status(400).json({ error: 'userId and categories[] required' })
  const all = readJSON('categories.json', {})
  all[userId] = categories
  writeJSON('categories.json', all)
  res.json({ ok: true })
})

// Tasks state (combined for simplicity)
app.get('/tasks/state', (req, res) => {
  const userId = String(req.query.userId || '')
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const stateByUser = readJSON('tasks.json', {})
  const plansByUser = readJSON('plans.json', {})
  const userState = stateByUser[userId] || { started: {}, progress: {}, tasks: {} }
  let userPlans = plansByUser[userId] || {}

  // Auto-seed if the user has no plans yet
  if (Object.keys(userPlans).length === 0) {
    const seed = loadSeedPlan()
    if (seed) {
      const catId = 'sde3-backend-prep'
      userPlans = { [catId]: { title: seed.title || 'SDE3 Backend Prep', startDate: getTomorrowISODate(), raw: seed } }
      plansByUser[userId] = userPlans
      writeJSON('plans.json', plansByUser)

      // Also ensure a matching category exists
      const catsAll = readJSON('categories.json', {})
      const currentCats = Array.isArray(catsAll[userId]) ? catsAll[userId] : []
      if (!currentCats.some(c => c.id === catId)) {
        const nextCats = [{ id: catId, name: 'SDE3 Backend Prep', color: '#2563eb' }, ...currentCats]
        catsAll[userId] = nextCats
        writeJSON('categories.json', catsAll)
      }
    }
  }

  // Auto-seed tasks for each category if missing, based on the plan's schedule
  let seededAny = false
  for (const categoryId of Object.keys(userPlans)) {
    const p = userPlans[categoryId]
    const existing = (userState.tasks || {})[categoryId] || {}
    const nextTasks = { ...existing }
    const raw = p && p.raw
    const schedule = raw && Array.isArray(raw.schedule) ? raw.schedule : []
    if (schedule.length > 0) {
      for (const wk of schedule) {
        const weekNum = wk?.week
        const days = Array.isArray(wk?.days) ? wk.days : []
        for (const day of days) {
          const dayStr = String(day?.day ?? '')
          // Problems under patterns
          const patterns = Array.isArray(day?.patterns) ? day.patterns : []
          for (const pat of patterns) {
            const problems = Array.isArray(pat?.problems) ? pat.problems : []
            for (const prob of problems) {
              const key = makeTaskKey(categoryId, weekNum, dayStr, 'problem', prob)
              if (!nextTasks[key]) nextTasks[key] = { completed: false }
            }
          }
          // Activities
          const activities = Array.isArray(day?.activities) ? day.activities : []
          for (const act of activities) {
            const key = makeTaskKey(categoryId, weekNum, dayStr, 'activity', act)
            if (!nextTasks[key]) nextTasks[key] = { completed: false }
          }
        }
      }
    }
    if (Object.keys(nextTasks).length > Object.keys(existing).length) {
      if (!userState.tasks) userState.tasks = {}
      userState.tasks[categoryId] = nextTasks
      seededAny = true
    }
  }

  if (seededAny) {
    stateByUser[userId] = userState
    writeJSON('tasks.json', stateByUser)
  }

  // Build the shape expected by client: { started, progress, plans: { [categoryId]: { title, startDate, raw, tasks } } }
  const plans = {}
  for (const categoryId of Object.keys(userPlans)) {
    const p = userPlans[categoryId]
    const tasks = (userState.tasks || {})[categoryId] || {}
    plans[categoryId] = { title: p.title, startDate: p.startDate ?? null, raw: p.raw, tasks }
  }
  res.json({ started: userState.started || {}, progress: userState.progress || {}, plans })
})

app.put('/tasks/state', (req, res) => {
  const { userId, state } = req.body || {}
  if (!userId || !state || typeof state !== 'object') return res.status(400).json({ error: 'userId and state required' })
  // Split incoming combined state into plans.json and tasks.json
  const plansByUser = readJSON('plans.json', {})
  const tasksByUser = readJSON('tasks.json', {})

  // Persist plans
  const userPlans = {}
  for (const [categoryId, plan] of Object.entries(state.plans || {})) {
    userPlans[categoryId] = { title: plan.title, startDate: plan.startDate ?? null, raw: plan.raw }
  }
  plansByUser[userId] = userPlans

  // Persist tasks meta, started, progress
  const userTasks = {
    started: state.started || {},
    progress: state.progress || {},
    tasks: Object.fromEntries(
      Object.entries(state.plans || {}).map(([categoryId, plan]) => [categoryId, plan.tasks || {}])
    ),
  }
  tasksByUser[userId] = userTasks

  writeJSON('plans.json', plansByUser)
  writeJSON('tasks.json', tasksByUser)

  res.json({ ok: true })
})

// Frontend: single-server setup
// In production, serve prebuilt assets from react-client/dist
// In development, run Vite in middleware mode to serve the client on the same port
const isProd = process.env.NODE_ENV === 'production'
if (isProd) {
  const distDir = path.resolve(__dirname, '../react-client/dist')
  const indexHtml = path.join(distDir, 'index.html')
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    const p = req.path
    if (p.startsWith('/auth') || p.startsWith('/categories') || p.startsWith('/tasks') || p.startsWith('/health')) return next()
    res.sendFile(indexHtml)
  })
} else {
  const startVite = async () => {
    const { createServer: createViteServer } = await import('vite')
    const clientRoot = path.resolve(__dirname, '../react-client')
    const vite = await createViteServer({
      root: clientRoot,
      server: { middlewareMode: true },
    })
    app.use(vite.middlewares)
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl
      if (url.startsWith('/auth') || url.startsWith('/categories') || url.startsWith('/tasks') || url.startsWith('/health')) return next()
      try {
        let template = fs.readFileSync(path.resolve(clientRoot, 'index.html'), 'utf8')
        template = await vite.transformIndexHtml(url, template)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
      } catch (e) {
        vite.ssrFixStacktrace(e)
        next(e)
      }
    })
  }
  // Fire and forget; if it fails, server APIs still work
  // eslint-disable-next-line promise/catch-or-return
  startVite()
}

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`tracker server listening on http://localhost:${PORT}`)
})
