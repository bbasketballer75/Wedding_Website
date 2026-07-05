import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { AdminLayout } from './admin/AdminLayout'

export default function Admin() {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className='theme-canvas flex min-h-screen items-center justify-center px-4'>
        <div className='theme-panel w-full max-w-2xl rounded-[1.25rem] p-5'>
          <div className='theme-skeleton h-5 w-36 rounded-full' />
          <div className='theme-skeleton mt-5 h-10 w-2/3 rounded-2xl' />
          <div className='theme-skeleton mt-6 h-28 rounded-xl' />
          <span className='sr-only'>Loading admin workspace...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to='/admin/login' replace state={{ from: redirectTo }} />
  }

  return <AdminLayout />
}
