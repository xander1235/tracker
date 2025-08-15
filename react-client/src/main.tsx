import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import router from '@/routes/router'
import { CategoriesProvider } from '@/store/CategoriesProvider'
import { TasksProvider } from '@/store/TasksProvider'
import { ThemeProvider } from '@/store/ThemeProvider'
import { AuthProvider } from '@/store/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CategoriesProvider>
          <TasksProvider>
            <RouterProvider router={router} />
          </TasksProvider>
        </CategoriesProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
