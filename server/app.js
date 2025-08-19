import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import { customAlphabet } from 'nanoid'
import admin from 'firebase-admin'

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

// Firestore (optional): enabled if FIREBASE_SERVICE_ACCOUNT is set
let db = null
const useFirestore = !!process.env.FIREBASE_SERVICE_ACCOUNT
if (useFirestore) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }
    db = admin.firestore()
    // eslint-disable-next-line no-console
    console.log('Firestore enabled')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Firestore, falling back to local JSON:', e?.message || e)
  }
}

export function createApp(opts = { withFrontend: false }) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  app.get('/health', (req, res) => res.json({ ok: true }))

  // Expose Firebase public config at runtime (for client initialization)
  app.get('/config/firebase', (req, res) => {
    const raw = process.env.FIREBASE_PUBLIC_CONFIG
    if (!raw) return res.status(404).json({ error: 'not configured' })
    try {
      const cfg = JSON.parse(raw)
      return res.json(cfg)
    } catch {
      return res.status(500).json({ error: 'invalid FIREBASE_PUBLIC_CONFIG' })
    }
  })

  // Auth
  app.post('/auth/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body || {}
      if (!email || !password) return res.status(400).json({ error: 'email and password required' })
      const id = nanoid()
      const passwordHash = bcrypt.hashSync(password, 10)
      if (db) {
        const snap = await db.collection('users').where('email', '==', String(email).toLowerCase()).limit(1).get()
        if (!snap.empty) return res.status(409).json({ error: 'User already exists' })
        const user = { id, name: name || '', email: String(email).toLowerCase(), passwordHash, provider: 'password' }
        await db.collection('users').doc(id).set(user)
        return res.json({ id, name: user.name, email: user.email })
      } else {
        const users = readJSON('users.json', [])
        const exists = users.find(u => u.email.toLowerCase() === String(email).toLowerCase())
        if (exists) return res.status(409).json({ error: 'User already exists' })
        const user = { id, name: name || '', email, passwordHash }
        users.push(user)
        writeJSON('users.json', users)
        return res.json({ id, name: user.name, email: user.email })
      }
    } catch (e) {
      res.status(500).json({ error: 'signup failed' })
    }
  })

  app.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {}
      if (!email || !password) return res.status(400).json({ error: 'email and password required' })
      if (db) {
        const snap = await db.collection('users').where('email', '==', String(email).toLowerCase()).limit(1).get()
        if (snap.empty) return res.status(401).json({ error: 'Invalid credentials' })
        const user = snap.docs[0].data()
        if (!user?.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })
        const ok = bcrypt.compareSync(password, user.passwordHash)
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
        return res.json({ id: user.id, name: user.name, email: user.email })
      } else {
        const users = readJSON('users.json', [])
        const user = users.find(u => u.email.toLowerCase() === String(email).toLowerCase())
        if (!user) return res.status(401).json({ error: 'Invalid credentials' })
        const ok = bcrypt.compareSync(password, user.passwordHash)
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
        return res.json({ id: user.id, name: user.name, email: user.email })
      }
    } catch (e) {
      res.status(500).json({ error: 'login failed' })
    }
  })

  // Google login (requires Firestore)
  app.post('/auth/google', async (req, res) => {
    if (!db) return res.status(501).json({ error: 'Google auth not configured' })
    try {
      const { idToken } = req.body || {}
      if (!idToken) return res.status(400).json({ error: 'idToken required' })
      const decoded = await admin.auth().verifyIdToken(idToken)
      const email = (decoded.email || '').toLowerCase()
      const name = decoded.name || ''
      const uid = decoded.uid
      if (!email) return res.status(400).json({ error: 'email not present on token' })
      let userId = uid
      // try find by email
      const snap = await db.collection('users').where('email', '==', email).limit(1).get()
      if (!snap.empty) {
        const u = snap.docs[0].data()
        userId = u.id
      } else {
        const user = { id: userId, name, email, provider: 'google' }
        await db.collection('users').doc(userId).set(user)
      }
      res.json({ id: userId, name, email })
    } catch (e) {
      res.status(401).json({ error: 'invalid token' })
    }
  })

  // Categories
  app.get('/categories', async (req, res) => {
    const userId = String(req.query.userId || '')
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (db) {
      const doc = await db.collection('categories').doc(userId).get()
      const items = doc.exists ? (doc.data()?.items || []) : []
      return res.json(items)
    } else {
      const all = readJSON('categories.json', {})
      let list = Array.isArray(all[userId]) ? all[userId] : []
      // Auto-seed default category and plan for new users
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
      return res.json(list)
    }
  })

  app.put('/categories', async (req, res) => {
    const { userId, categories } = req.body || {}
    if (!userId || !Array.isArray(categories)) return res.status(400).json({ error: 'userId and categories[] required' })
    if (db) {
      await db.collection('categories').doc(userId).set({ items: categories })
      return res.json({ ok: true })
    } else {
      const all = readJSON('categories.json', {})
      all[userId] = categories
      writeJSON('categories.json', all)
      return res.json({ ok: true })
    }
  })

  // Tasks state (combined for simplicity)
  app.get('/tasks/state', async (req, res) => {
    const userId = String(req.query.userId || '')
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (db) {
      const doc = await db.collection('tasksState').doc(userId).get()
      if (!doc.exists) return res.json({ started: {}, progress: {}, plans: {} })
      const state = doc.data() || {}
      // Ensure shape
      return res.json({ started: state.started || {}, progress: state.progress || {}, plans: state.plans || {} })
    } else {
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
      const plans = {}
      for (const categoryId of Object.keys(userPlans)) {
        const p = userPlans[categoryId]
        const tasks = (userState.tasks || {})[categoryId] || {}
        plans[categoryId] = { title: p.title, startDate: p.startDate ?? null, raw: p.raw, tasks }
      }
      return res.json({ started: userState.started || {}, progress: userState.progress || {}, plans })
    }
  })

  app.put('/tasks/state', async (req, res) => {
    const { userId, state } = req.body || {}
    if (!userId || !state || typeof state !== 'object') return res.status(400).json({ error: 'userId and state required' })
    if (db) {
      await db.collection('tasksState').doc(userId).set({
        started: state.started || {},
        progress: state.progress || {},
        plans: state.plans || {},
      })
      return res.json({ ok: true })
    } else {
      const plansByUser = readJSON('plans.json', {})
      const tasksByUser = readJSON('tasks.json', {})
      const userPlans = {}
      for (const [categoryId, plan] of Object.entries(state.plans || {})) {
        userPlans[categoryId] = { title: plan.title, startDate: plan.startDate ?? null, raw: plan.raw }
      }
      plansByUser[userId] = userPlans
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
      return res.json({ ok: true })
    }
  })

  // In Netlify Functions, we do not serve frontend; Hosting serves static build.
  // For local dev or other runtime, optionally attach frontend middleware.
  if (opts.withFrontend) {
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd) {
      const distDir = path.resolve(__dirname, '../react-client/dist')
      const indexHtml = path.join(distDir, 'index.html')
      app.use(express.static(distDir))
      app.get('*', (req, res, next) => {
        const p = req.path
        if (p.startsWith('/auth') || p.startsWith('/categories') || p.startsWith('/tasks') || p.startsWith('/health') || p.startsWith('/config')) return next()
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
          if (url.startsWith('/auth') || url.startsWith('/categories') || url.startsWith('/tasks') || url.startsWith('/health') || url.startsWith('/config')) return next()
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
      // fire and forget
      // eslint-disable-next-line promise/catch-or-return
      startVite()
    }
  }

  return app
}
