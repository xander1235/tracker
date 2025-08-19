import serverless from 'serverless-http'
import { createApp } from '../../server/app.js'

// API-only app for Netlify Functions
const app = createApp({ withFrontend: false })

export const handler = serverless(app)
