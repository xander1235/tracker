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
  res.json(all[userId] || [])
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
  const userPlans = plansByUser[userId] || {}
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
