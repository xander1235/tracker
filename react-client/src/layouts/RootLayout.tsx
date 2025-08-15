import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/store/AuthProvider'
import { useTheme } from '@/store/ThemeProvider'

export default function RootLayout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const onAuth = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const displayName = user ? (user.name?.trim() || (user.email?.split('@')[0] ?? '')) : ''

  return (
    <div className="app">
      <header className="header">
        <nav className="nav" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavLink to="/home" className="brand">Tracker</NavLink>
          {!onAuth && (
            <NavLink to="/home" className={({ isActive }) => (isActive ? 'active' : '')}>
              Home
            </NavLink>
          )}
        </nav>
        <div className="header-right">
          <button type="button" onClick={toggle} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌞' : '🌙'}
          </button>
          {user ? (
            <>
              <span className="muted user-label" style={{ marginLeft: 8 }} title={user.email}>{displayName}</span>
              <button
                type="button"
                onClick={logout}
                className="danger btn-icon btn-icon-lg"
                style={{ marginLeft: 8 }}
                aria-label="Logout"
                title="Logout"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" style={{ marginLeft: 8 }}>Login</NavLink>
              <NavLink to="/signup" style={{ marginLeft: 8 }}>Signup</NavLink>
            </>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
