import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import Home from '@/pages/Home'
import TasksPage from '@/pages/Tasks'
import NotFound from '@/pages/NotFound'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import RequireAuth from '@/routes/RequireAuth'
import RequireGuest from '@/routes/RequireGuest'

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<RootLayout />}>
      <Route index element={<Navigate to="/home" replace />} />
      <Route path="home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="tasks/:categoryId" element={<RequireAuth><TasksPage /></RequireAuth>} />
      <Route path="login" element={<RequireGuest><Login /></RequireGuest>} />
      <Route path="signup" element={<RequireGuest><Signup /></RequireGuest>} />
      <Route path="*" element={<NotFound />} />
    </Route>
  )
)

export default router
