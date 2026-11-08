import { BarChart3, CheckCircle, Eye, Image as ImageIcon, MessageSquare } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { ANALYTICS_WINDOW_LABELS, type AnalyticsData } from './analytics-data'
import { useAnalytics } from './useAnalytics'

/**
 * `/admin/analytics` — DB-backed activity counts in 7/30/90-day windows.
 *
 * Ported from the frozen `src/pages/admin/Analytics.tsx`: four StatCards plus
 * the guest/professional split, the window buttons and the explicit
 * "Database Activity Only" notice that traffic dashboards live in GA4/Sentry.
 */
export interface AnalyticsPageProps {
  readonly data?: AnalyticsData
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  alert = false,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  color: 'blue' | 'green' | 'amber' | 'purple'
  alert?: boolean
}) {
  const colors: Record<'blue' | 'green' | 'amber' | 'purple', string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-[1.2rem] p-4 shadow-sm border',
        alert ? 'border-amber-400' : 'border-gold-100'
      )}
    >
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-sm text-charcoal-500'>{title}</p>
          <p className='mt-1 text-[2rem] font-display leading-none text-charcoal-900'>{value}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', colors[color])}>
          <Icon className='h-5 w-5' aria-hidden='true' />
        </div>
      </div>
      {alert && (
        <p className='text-amber-600 text-xs mt-2 flex items-center gap-1'>
          <span className='w-2 h-2 bg-amber-500 rounded-full animate-pulse' aria-hidden='true' />
          Requires attention
        </p>
      )}
    </div>
  )
}

export function AnalyticsPage({ data }: AnalyticsPageProps = {}) {
  const analytics = useAnalytics({ data })
  const { counts } = analytics

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-2xl font-display text-charcoal-900'>Analytics Dashboard</h2>
        <div className='flex gap-2' role='group' aria-label='Analytics time range'>
          {analytics.windows.map(window => (
            <button
              key={window}
              type='button'
              aria-pressed={analytics.window === window}
              onClick={() => analytics.changeWindow(window)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                analytics.window === window
                  ? 'bg-gold-500 text-charcoal-900'
                  : 'bg-white text-charcoal-600 hover:bg-gold-50 border border-gold-200'
              )}
            >
              {ANALYTICS_WINDOW_LABELS[window]}
            </button>
          ))}
        </div>
      </div>

      {analytics.loading ? (
        <div className='text-center py-12' role='status'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto' />
          <p className='text-charcoal-500 mt-4'>Loading analytics...</p>
        </div>
      ) : (
        <>
          {analytics.error && (
            <p
              role='alert'
              className='rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
            >
              {analytics.error}
            </p>
          )}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <StatCard
              title='Approved Uploads'
              value={counts.approvedUploads.toString()}
              icon={CheckCircle}
              color='blue'
            />
            <StatCard
              title='Pending Uploads'
              value={counts.pendingUploads.toString()}
              icon={Eye}
              color='green'
              alert={counts.pendingUploads > 0}
            />
            <StatCard
              title='Guestbook Entries'
              value={counts.guestbookEntries.toString()}
              icon={MessageSquare}
              color='amber'
            />
            <StatCard
              title='Photos Published'
              value={counts.publishedPhotos.toString()}
              icon={ImageIcon}
              color='purple'
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-white rounded-xl p-6 border border-gold-100'>
              <p className='text-sm text-charcoal-500'>Guest Photos Published</p>
              <p className='text-3xl font-display text-charcoal-900 mt-2'>{counts.guestPhotos}</p>
              <p className='text-sm text-charcoal-400 mt-1'>
                Approved guest submissions that made it into the live gallery
              </p>
            </div>
            <div className='bg-white rounded-xl p-6 border border-gold-100'>
              <p className='text-sm text-charcoal-500'>Professional Photos Added</p>
              <p className='text-3xl font-display text-charcoal-900 mt-2'>
                {counts.professionalPhotos}
              </p>
              <p className='text-sm text-charcoal-400 mt-1'>
                Curated additions published during the selected window
              </p>
            </div>
          </div>

          <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3'>
            <BarChart3 className='w-5 h-5 text-blue-500 mt-0.5' aria-hidden='true' />
            <div>
              <p className='font-medium text-blue-900'>Database Activity Only</p>
              <p className='text-sm text-blue-700 mt-1'>
                This admin screen now shows only verified database counts for the selected period.
                For traffic, page views, and audience behavior, use the live Google Analytics and
                Sentry dashboards outside the app.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
