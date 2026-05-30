import { useState, useEffect, useCallback } from 'react'
import { Image, MessageSquare, CheckCircle, Eye, BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { StatCard } from './shared'

export function Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [analytics, setAnalytics] = useState({
    approvedUploads: 0,
    pendingUploads: 0,
    guestbookEntries: 0,
    publishedPhotos: 0,
    guestPhotos: 0,
    professionalPhotos: 0,
  })
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const [
        { count: approvedUploads, error: approvedError },
        { count: pendingUploads, error: pendingError },
        { count: guestbookEntries, error: guestbookError },
        { count: publishedPhotos, error: publishedError },
        { count: guestPhotos, error: guestPhotosError },
        { count: professionalPhotos, error: professionalPhotosError },
      ] = await Promise.all([
        supabase
          .from('guest_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('guest_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('guestbook_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('is_professional', false)
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('photos')
          .select('*', { count: 'exact', head: true })
          .eq('is_professional', true)
          .gte('created_at', startDate.toISOString()),
      ])

      const firstError =
        approvedError ||
        pendingError ||
        guestbookError ||
        publishedError ||
        guestPhotosError ||
        professionalPhotosError

      if (firstError) {
        throw firstError
      }

      setAnalytics({
        approvedUploads: approvedUploads || 0,
        pendingUploads: pendingUploads || 0,
        guestbookEntries: guestbookEntries || 0,
        publishedPhotos: publishedPhotos || 0,
        guestPhotos: guestPhotos || 0,
        professionalPhotos: professionalPhotos || 0,
      })
    } catch {
      addToast('Failed to load analytics', 'error')
    }
    setLoading(false)
  }, [addToast, timeRange])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAnalytics()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchAnalytics])

  const timeRangeLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-display text-charcoal-900'>Analytics Dashboard</h2>
        <div className='flex gap-2'>
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-gold-500 text-white'
                  : 'bg-white text-charcoal-600 hover:bg-gold-50 border border-gold-200'
              }`}
            >
              {timeRangeLabels[range]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className='text-center py-12'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto' />
          <p className='text-charcoal-500 mt-4'>Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <StatCard
              title='Approved Uploads'
              value={analytics.approvedUploads.toString()}
              icon={CheckCircle}
              color='blue'
            />
            <StatCard
              title='Pending Uploads'
              value={analytics.pendingUploads.toString()}
              icon={Eye}
              color='green'
              alert={analytics.pendingUploads > 0}
            />
            <StatCard
              title='Guestbook Entries'
              value={analytics.guestbookEntries.toString()}
              icon={MessageSquare}
              color='amber'
            />
            <StatCard
              title='Photos Published'
              value={analytics.publishedPhotos.toString()}
              icon={Image}
              color='purple'
            />
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='bg-white rounded-xl p-6 border border-gold-100'>
              <p className='text-sm text-charcoal-500'>Guest Photos Published</p>
              <p className='text-3xl font-display text-charcoal-900 mt-2'>
                {analytics.guestPhotos}
              </p>
              <p className='text-sm text-charcoal-400 mt-1'>
                Approved guest submissions that made it into the live gallery
              </p>
            </div>
            <div className='bg-white rounded-xl p-6 border border-gold-100'>
              <p className='text-sm text-charcoal-500'>Professional Photos Added</p>
              <p className='text-3xl font-display text-charcoal-900 mt-2'>
                {analytics.professionalPhotos}
              </p>
              <p className='text-sm text-charcoal-400 mt-1'>
                Curated additions published during the selected window
              </p>
            </div>
          </div>

          <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3'>
            <BarChart3 className='w-5 h-5 text-blue-500 mt-0.5' />
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
