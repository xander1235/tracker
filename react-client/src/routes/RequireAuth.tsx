import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />
  return children
}
