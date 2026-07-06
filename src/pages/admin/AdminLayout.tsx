import { lazy, Suspense } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { LogOut } from 'lucide-react'
import { MediaReviewPanel } from '@/components/admin/MediaReviewPanel'
import { AlbumOrganizer } from '@/components/admin/AlbumOrganizer'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import { adminNavSections, getAdminRouteMeta } from './utils'

const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })))
const PhotoModeration = lazy(() =>
  import('./PhotoModeration').then(m => ({ default: m.PhotoModeration }))
)
const GuestbookModeration = lazy(() =>
  import('./GuestbookModeration').then(m => ({ default: m.GuestbookModeration }))
)
const ClaimsModeration = lazy(() =>
  import('./ClaimsModeration').then(m => ({ default: m.ClaimsModeration }))
)
const AuditLogView = lazy(() => import('./AuditLogView').then(m => ({ default: m.AuditLogView })))
const FeaturedContentManager = lazy(() =>
  import('./FeaturedContentManager').then(m => ({ default: m.FeaturedContentManager }))
)
const Analytics = lazy(() => import('./Analytics').then(m => ({ default: m.Analytics })))
const Settings = lazy(() => import('./Settings').then(m => ({ default: m.Settings })))

function AdminPageSkeleton() {
  return (
    <div className='space-y-4 animate-pulse'>
      <div className='theme-skeleton h-8 w-48 rounded-lg' />
      <div className='theme-skeleton h-32 rounded-2xl' />
      <div className='theme-skeleton h-64 rounded-2xl' />
    </div>
  )
}

export function AdminLayout() {
  const location = useLocation()
  const { signOut, user } = useAuthStore()
  const { addToast } = useToast()
  const currentPage = getAdminRouteMeta(location.pathname)
  const isDashboardRoute = location.pathname === '/admin'
  const isReviewRoute = location.pathname.startsWith('/admin/review')

  const handleSignOut = async () => {
    await signOut()
    addToast('Signed out successfully', 'success')
  }

  return (
    <div className='theme-canvas min-h-screen'>
      {/* Admin Header */}
      <header
        data-testid='admin-header'
        className='sticky top-0 z-30 border-b border-[color:var(--ui-border)] bg-[color:var(--ui-glass)] backdrop-blur-xl'
      >
        <div className='mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <Link to='/' className='font-display text-xl text-[color:var(--ui-text)]'>
              <span className='text-gold-500'>A</span>&<span className='text-gold-500'>J</span>
              <span className='theme-muted ml-2 text-sm font-normal'>Admin</span>
            </Link>
            <p className='theme-muted mt-1 text-sm'>
              A calmer workspace for moderation, people review, and site upkeep.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-3 sm:justify-end'>
            <ThemeToggle className='shadow-none' />
            <div className='rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2 text-sm text-[color:var(--ui-muted)]'>
              Signed in as{' '}
              <span className='font-medium text-[color:var(--ui-text)]'>
                {user?.email || 'admin'}
              </span>
            </div>
            <Button
              data-testid='admin-signout'
              size='sm'
              variant='secondary'
              onClick={handleSignOut}
            >
              <LogOut className='mr-2 h-4 w-4' />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div
        className={cn('mx-auto px-4 py-6 xl:py-8', isReviewRoute ? 'max-w-[110rem]' : 'max-w-7xl')}
      >
        {!isDashboardRoute && !isReviewRoute && (
          <section className='theme-panel mb-4 rounded-[1.15rem] px-4 py-4 sm:px-5'>
            <div className='max-w-3xl'>
              <p className='theme-subtle text-[10px] uppercase tracking-[0.24em]'>
                {currentPage.eyebrow}
              </p>
              <h1 className='mt-1 font-display text-[1.6rem] leading-tight'>{currentPage.title}</h1>
              <p className='theme-muted mt-1 text-sm leading-5'>{currentPage.description}</p>
            </div>
          </section>
        )}

        {!isReviewRoute && (
          <div
            data-testid='admin-mobile-nav'
            className='mb-5 flex gap-2 overflow-x-auto pb-1 xl:hidden'
          >
            {adminNavSections
              .flatMap(section => section.items)
              .map(item => {
                const isActive = location.pathname === item.path

                return (
                  <Button
                    key={item.path}
                    variant={isActive ? 'primary' : 'secondary'}
                    size='sm'
                    asChild
                  >
                    <Link to={item.path}>{item.label}</Link>
                  </Button>
                )
              })}
          </div>
        )}

        {isReviewRoute ? (
          <main className='min-w-0'>
            <div className='theme-panel mb-4 flex items-center justify-between gap-3 rounded-[1.15rem] px-4 py-3'>
              <div className='min-w-0'>
                <p className='theme-subtle text-[10px] uppercase tracking-[0.24em]'>
                  {currentPage.eyebrow}
                </p>
                <h1 className='mt-1 text-xl font-display leading-tight'>{currentPage.title}</h1>
              </div>
              <Button variant='secondary' size='sm' asChild>
                <Link to='/admin'>Back to Dashboard</Link>
              </Button>
            </div>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path='photos' element={<PhotoModeration />} />
                <Route path='albums' element={<AlbumOrganizer />} />
                <Route path='review' element={<MediaReviewPanel />} />
                <Route path='claims' element={<ClaimsModeration />} />
                <Route path='guestbook' element={<GuestbookModeration />} />
                <Route path='featured' element={<FeaturedContentManager />} />
                <Route path='audit' element={<AuditLogView />} />
                <Route path='analytics' element={<Analytics />} />
                <Route path='settings' element={<Settings />} />
              </Routes>
            </Suspense>
          </main>
        ) : (
          <div className='flex flex-col gap-5 xl:flex-row xl:gap-6'>
            {/* Sidebar */}
            <nav
              data-testid='admin-sidebar'
              className='hidden w-full xl:block xl:w-64 xl:flex-shrink-0'
              aria-label='Admin navigation'
            >
              <div className='theme-panel overflow-hidden rounded-[1.4rem] xl:sticky xl:top-24'>
                <div className='border-b border-[color:var(--ui-border)] px-4 py-4'>
                  <p className='theme-subtle text-[11px] uppercase tracking-[0.24em]'>
                    Workspace map
                  </p>
                  <p className='theme-muted mt-2 text-sm leading-5'>
                    Open the tool that matches the work in front of you.
                  </p>
                </div>
                <div className='space-y-5 px-3 py-4'>
                  {adminNavSections.map(section => (
                    <div key={section.title}>
                      <div className='px-2 pb-1'>
                        <p className='theme-subtle text-[11px] uppercase tracking-[0.22em]'>
                          {section.title}
                        </p>
                      </div>
                      <div className='space-y-2'>
                        {section.items.map(item => {
                          const Icon = item.icon
                          const isActive = location.pathname === item.path

                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              className={`block rounded-[1rem] border px-3 py-3 transition-all ${
                                isActive
                                  ? 'border-[color:var(--ui-accent)] bg-[color:var(--ui-surface-elevated)] text-[color:var(--ui-accent-strong)] shadow-[var(--ui-shadow)]'
                                  : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--ui-muted)] hover:border-[color:var(--ui-accent)] hover:bg-[color:var(--ui-surface-elevated)] hover:text-[color:var(--ui-text)]'
                              }`}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              <div className='flex items-start gap-3'>
                                <div
                                  className={`rounded-lg p-2 ${isActive ? 'bg-[color:var(--ui-glass)] text-[color:var(--ui-accent-strong)]' : 'bg-[color:var(--ui-surface-elevated)] text-[color:var(--ui-muted)]'}`}
                                >
                                  <Icon className='h-4 w-4' />
                                </div>
                                <div className='min-w-0'>
                                  <p className='text-sm font-medium'>{item.label}</p>
                                  <p
                                    className={`mt-1 text-xs leading-5 ${isActive ? 'text-[color:var(--ui-accent-strong)]' : 'text-[color:var(--ui-muted)]'}`}
                                  >
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <main data-testid='admin-content' className='min-w-0 flex-1'>
              <Suspense fallback={<AdminPageSkeleton />}>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path='photos' element={<PhotoModeration />} />
                  <Route path='albums' element={<AlbumOrganizer />} />
                  <Route path='review' element={<MediaReviewPanel />} />
                  <Route path='claims' element={<ClaimsModeration />} />
                  <Route path='guestbook' element={<GuestbookModeration />} />
                  <Route path='featured' element={<FeaturedContentManager />} />
                  <Route path='audit' element={<AuditLogView />} />
                  <Route path='analytics' element={<Analytics />} />
                  <Route path='settings' element={<Settings />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        )}
      </div>
    </div>
  )
}
