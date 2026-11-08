/**
 * Admin shell, ported from the frozen `src/pages/admin/AdminLayout.tsx`.
 *
 * Frozen structure preserved: sticky admin header (A&J Admin wordmark, subtitle,
 * theme toggle, signed-in email, sign-out), page-header panel for non-dashboard
 * pages, horizontal mobile nav (<xl), workspace sidebar (>=xl) and the page
 * content region. `/admin/review` keeps its full-width chrome variant.
 *
 * DELTAS (documented in the W7-1 report):
 * - react-router nested `<Routes>` become the injected page registry in
 *   `AdminApp` (child routes are Lead-wired);
 * - the frozen toast on sign-out is replaced by an inline `role=status`/`alert`
 *   message because the rebuild has no ToastProvider yet;
 * - nav links use the splat route so the feature does not depend on the exact
 *   child-route declarations (URLs are unchanged: /admin/photos etc.).
 */
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { ThemeToggle } from '@/app/shell/ThemeToggle'
import { cn } from '@/shared/lib/cn'
import { buttonVariants } from '@/shared/ui/buttonVariants'
import { Button } from '@/shared/ui/Button'
import { useAdminAuth } from '../auth-context'
import type { AdminSection } from '../data'
import { AdminSectionLink } from '../AdminLinks'
import { useAdminRouteSection } from '../routing'
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS, getAdminRouteMeta } from '../utils'

export interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const auth = useAdminAuth()
  const section = useAdminRouteSection()
  const currentPage = getAdminRouteMeta(section)
  const isDashboardRoute = section === 'dashboard'
  const isReviewRoute = section === 'review'
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      setAuthMessage('Signed out successfully')
    } catch {
      setAuthMessage('Could not sign out. Please try again.')
    }
  }

  return (
    <div className='theme-canvas min-h-screen'>
      <header
        data-testid='admin-header'
        className='sticky top-0 z-30 border-b border-[color:var(--ui-border)] bg-[color:var(--ui-glass)] backdrop-blur-xl'
      >
        <div className='mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <AdminSectionLink
              section='dashboard'
              className='font-display text-xl text-[color:var(--ui-text)]'
            >
              <span className='text-gold-500'>A</span>&<span className='text-gold-500'>J</span>
              <span className='theme-muted ml-2 text-sm font-normal'>Admin</span>
            </AdminSectionLink>
            <p className='theme-muted mt-1 text-sm'>
              A calmer workspace for moderation, people review, and site upkeep.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-3 sm:justify-end'>
            <ThemeToggle className='shadow-none' />
            <div className='rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-4 py-2 text-sm text-[color:var(--ui-muted)]'>
              Signed in as{' '}
              <span className='font-medium text-[color:var(--ui-text)]'>
                {auth.user?.email || 'admin'}
              </span>
            </div>
            <Button
              data-testid='admin-signout'
              size='sm'
              variant='secondary'
              onClick={() => void handleSignOut()}
            >
              <LogOut className='mr-2 h-4 w-4' aria-hidden='true' />
              Sign Out
            </Button>
          </div>
        </div>
        {authMessage && (
          <p
            role={authMessage.includes('Could not') ? 'alert' : 'status'}
            className='mx-auto max-w-7xl px-4 pb-3 text-sm text-charcoal-600'
          >
            {authMessage}
          </p>
        )}
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
            {ADMIN_NAV_ITEMS.map(item => (
              <AdminSectionLink
                key={item.section}
                section={item.section}
                className={buttonVariants({
                  variant: section === item.section ? 'primary' : 'secondary',
                  size: 'sm',
                  className: 'shrink-0',
                })}
                ariaCurrent={section === item.section ? 'page' : undefined}
              >
                {item.label}
              </AdminSectionLink>
            ))}
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
              <AdminSectionLink
                section='dashboard'
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Back to Dashboard
              </AdminSectionLink>
            </div>
            {children}
          </main>
        ) : (
          <div className='flex flex-col gap-5 xl:flex-row xl:gap-6'>
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
                  {ADMIN_NAV_SECTIONS.map(navSection => (
                    <div key={navSection.title}>
                      <div className='px-2 pb-1'>
                        <p className='theme-subtle text-[11px] uppercase tracking-[0.22em]'>
                          {navSection.title}
                        </p>
                      </div>
                      <div className='space-y-2'>
                        {navSection.items.map(item => {
                          const Icon = item.icon
                          const isActive = section === item.section

                          return (
                            <AdminSectionLink
                              key={item.section}
                              section={item.section}
                              ariaCurrent={isActive ? 'page' : undefined}
                              className={cn(
                                'block rounded-[1rem] border px-3 py-3 transition-all',
                                isActive
                                  ? 'border-[color:var(--ui-accent)] bg-[color:var(--ui-surface-elevated)] text-[color:var(--ui-accent-strong)] shadow-[var(--ui-shadow)]'
                                  : 'border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] text-[color:var(--ui-muted)] hover:border-[color:var(--ui-accent)] hover:bg-[color:var(--ui-surface-elevated)] hover:text-[color:var(--ui-text)]'
                              )}
                            >
                              <div className='flex items-start gap-3'>
                                <div
                                  className={cn(
                                    'rounded-lg p-2',
                                    isActive
                                      ? 'bg-[color:var(--ui-glass)] text-[color:var(--ui-accent-strong)]'
                                      : 'bg-[color:var(--ui-surface-elevated)] text-[color:var(--ui-muted)]'
                                  )}
                                >
                                  <Icon className='h-4 w-4' aria-hidden='true' />
                                </div>
                                <div className='min-w-0'>
                                  <p className='text-sm font-medium'>{item.label}</p>
                                  <p
                                    className={cn(
                                      'mt-1 text-xs leading-5',
                                      isActive
                                        ? 'text-[color:var(--ui-accent-strong)]'
                                        : 'text-[color:var(--ui-muted)]'
                                    )}
                                  >
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                            </AdminSectionLink>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </nav>

            <main data-testid='admin-content' className='min-w-0 flex-1'>
              {children}
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

// Re-exported for pages that need the section type in props.
export type { AdminSection }
