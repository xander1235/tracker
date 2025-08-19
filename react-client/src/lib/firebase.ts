import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'

let appPromise: Promise<FirebaseApp> | null = null

async function loadConfig() {
  const res = await fetch('/config/firebase')
  if (!res.ok) throw new Error('Firebase not configured')
  return res.json()
}

async function getApp(): Promise<FirebaseApp> {
  if (getApps().length) return getApps()[0]!
  if (!appPromise) {
    appPromise = (async () => {
      const cfg = await loadConfig()
      return initializeApp(cfg)
    })()
  }
  return appPromise
}

export async function getFirebaseAuth(): Promise<Auth> {
  const app = await getApp()
  return getAuth(app)
}

export async function loginWithGooglePopup(): Promise<string> {
  const auth = await getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  const idToken = await result.user.getIdToken()
  return idToken
}
