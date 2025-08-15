import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signup(name, email, password)
      nav('/home', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Failed to sign up')
    }
  }

  return (
    <section className="auth">
      <div className="auth-shell">
        <div className="auth-pane">
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">Start tracking in minutes — your categories, your way.</p>
          <form className="auth-card form compact" onSubmit={onSubmit}>
            <div className="form-item">
              <label htmlFor="name" className="label">Name</label>
              <div className="input-wrap">
                <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  id="name"
                  type="text"
                  className="input has-icon"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="form-item">
              <label htmlFor="email" className="label">Email</label>
              <div className="input-wrap">
                <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8l8 5 8-5"/>
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  className="input has-icon"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-item">
              <label htmlFor="password" className="label">Password</label>
              <div className="input-wrap">
                <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input has-icon has-trailing"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  className="icon-right"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.78-1.79 2.02-3.37 3.58-4.65M10.58 10.58A2 2 0 0 0 13.42 13.42"/>
                      <path d="M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="small muted">Use at least 8 characters.</div>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary btn-block">Create account</button>
            <div className="auth-actions">
              <span className="muted">Already have an account? <Link to="/login">Login</Link></span>
            </div>
          </form>
        </div>
        <div className="auth-hero" aria-hidden="true">
          <svg
            className="auth-art"
            viewBox="0 0 800 600"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="sg1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--link)" stopOpacity=".35"/>
                <stop offset="100%" stopColor="currentColor" stopOpacity=".05"/>
              </linearGradient>
              <radialGradient id="sg2" cx="30%" cy="30%" r="60%">
                <stop offset="0%" stopColor="var(--link)" stopOpacity=".35"/>
                <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="200" cy="160" r="140" fill="url(#sg2)" />
            <circle cx="600" cy="420" r="180" fill="url(#sg2)" />
            <g stroke="url(#sg1)" strokeWidth="2" fill="none" opacity=".7">
              <path d="M50,520 C240,420 560,520 750,420" />
              <path d="M50,460 C240,360 560,460 750,360" />
              <path d="M50,400 C240,300 560,400 750,300" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  )
}
