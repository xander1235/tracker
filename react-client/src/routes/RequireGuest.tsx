import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'

export default function RequireGuest({ children }: { children: React.ReactElement }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/home" replace />
  return children
}
