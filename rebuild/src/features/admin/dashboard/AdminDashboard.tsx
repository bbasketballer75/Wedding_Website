/**
 * Admin dashboard, ported from the frozen `src/pages/admin/Dashboard.tsx`.
 *
 * Frozen copy, card structure and grid/class strings are preserved. Counts come
 * from the injected admin API (`fetchDashboardCounts`), covering the four DB
 * counters plus the two W7-2 people-review/tagging signals the frozen page
 * rendered.
 *
 * DELTAS: the frozen page wrapped itself in `ComponentErrorBoundary`; the
 * rebuild wraps the routed page in `AdminPageBoundary` and adds an inline
 * `role=status` failure message so a failed count read is visible (frozen kept
 * zeros silently).
 */
import {
  ArrowRight,
  CheckCircle,
  Eye,
  FolderOpen,
  Image,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { buttonVariants } from '@/shared/ui/buttonVariants'
import { useAdminApi } from '../api-context'
import type { AdminDashboardCounts } from '../data'
import { AdminSectionLink } from '../AdminLinks'
import { AdminStatCard } from '../shared/AdminUi'

const INITIAL_COUNTS: AdminDashboardCounts = {
  photos: 0,
  pendingUploads: 0,
  guestbookMessages: 0,
  approvedUploads: 0,
  peopleReviewBatchesInFlight: 0,
  lastGuestTaggingSyncLabel: 'No guest sync yet',
}

function AdminSignalRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'alert' | 'calm' | 'neutral'
}) {
  const toneClasses =
    tone === 'alert'
      ? 'border-amber-300 bg-amber-50'
      : tone === 'calm'
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-gold-100 bg-cream-50/70'

  return (
    <div className={`rounded-[1.25rem] border px-4 py-4 ${toneClasses}`}>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-[10px] uppercase tracking-[0.28em] text-charcoal-500'>{label}</p>
          <p className='mt-2 text-lg font-medium text-charcoal-900 break-words'>{value}</p>
        </div>
      </div>
      <p className='mt-1 text-sm leading-6 text-charcoal-600'>{detail}</p>
    </div>
  )
}

function WorkflowStep({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className='rounded-[1.1rem] border border-gold-100 bg-cream-50/70 px-4 py-4'>
      <div className='flex items-start gap-3'>
        <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-semibold text-white'>
          {step}
        </div>
        <div>
          <p className='text-sm font-medium text-charcoal-900'>{title}</p>
          <p className='mt-1 text-sm leading-5 text-charcoal-500'>{description}</p>
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const api = useAdminApi()
  const [counts, setCounts] = useState<AdminDashboardCounts>(INITIAL_COUNTS)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const next = await api.fetchDashboardCounts()
        if (active) {
          setCounts(next)
          setLoadError(null)
        }
      } catch {
        if (active) setLoadError('The dashboard counts could not be loaded right now.')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [api])

  return (
    <div className='space-y-6'>
      <section className='rounded-[1.5rem] border border-gold-100 bg-white px-5 py-5 shadow-sm sm:px-6'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
          <div className='max-w-3xl'>
            <p className='text-[11px] uppercase tracking-[0.32em] text-charcoal-500'>
              Austin + Jordyn control room
            </p>
            <h2 className='mt-2 font-display text-2xl leading-tight text-charcoal-900 sm:text-[2rem]'>
              A faster weekly view of what needs attention.
            </h2>
            <p className='mt-2 text-sm leading-6 text-charcoal-600'>
              Use this like a briefing, not a landing page: check the current state, then jump
              straight into the next workflow.
            </p>
          </div>

          <div className='grid gap-2 sm:grid-cols-2 xl:w-[24rem]'>
            <AdminSectionLink
              section='photos'
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Photos
            </AdminSectionLink>
            <AdminSectionLink
              section='albums'
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Albums
            </AdminSectionLink>
            <AdminSectionLink
              section='review'
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              People Review
            </AdminSectionLink>
            <AdminSectionLink
              section='guestbook'
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Guestbook
            </AdminSectionLink>
            <AdminSectionLink
              section='audit'
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Audit
            </AdminSectionLink>
          </div>
        </div>
      </section>

      {loadError && (
        <p
          role='status'
          className='rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900'
        >
          {loadError}
        </p>
      )}

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <AdminSignalRow
          label='Pending uploads'
          value={counts.pendingUploads.toString()}
          tone={counts.pendingUploads > 0 ? 'alert' : 'calm'}
          detail={counts.pendingUploads > 0 ? 'Waiting in /admin/photos.' : 'Queue is clear.'}
        />
        <AdminSignalRow
          label='People review'
          value={counts.peopleReviewBatchesInFlight.toString()}
          tone={counts.peopleReviewBatchesInFlight > 0 ? 'alert' : 'calm'}
          detail={
            counts.peopleReviewBatchesInFlight > 0 ? 'Batch still in flight.' : 'No active batch.'
          }
        />
        <AdminSignalRow
          label='Guest tagging sync'
          value={counts.lastGuestTaggingSyncLabel}
          tone='neutral'
          detail='Last metadata sync back into Gallery.'
        />
        <AdminSignalRow
          label='Approved uploads'
          value={counts.approvedUploads.toString()}
          tone='neutral'
          detail='Ready to browse or face-tag later.'
        />
      </div>

      <div className='grid grid-cols-2 gap-4 xl:grid-cols-4'>
        <AdminStatCard
          title='Live gallery photos'
          value={counts.photos}
          icon={Image}
          color='blue'
        />
        <AdminStatCard
          title='Pending review'
          value={counts.pendingUploads}
          icon={Eye}
          color='amber'
          alert={counts.pendingUploads > 0}
        />
        <AdminStatCard
          title='Guestbook entries'
          value={counts.guestbookMessages}
          icon={MessageSquare}
          color='green'
        />
        <AdminStatCard
          title='Approved uploads'
          value={counts.approvedUploads}
          icon={CheckCircle}
          color='purple'
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]'>
        <div className='rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='text-[11px] uppercase tracking-[0.32em] text-charcoal-500'>
                Recommended rhythm
              </p>
              <h3 className='mt-1 text-xl font-display text-charcoal-900'>Three steps, in order</h3>
            </div>
            <ShieldCheck className='h-5 w-5 text-gold-500' aria-hidden='true' />
          </div>
          <div className='mt-4 grid gap-3 lg:grid-cols-3'>
            <WorkflowStep step='1' title='Photos' description='Clear /admin/photos first.' />
            <WorkflowStep step='2' title='People' description='Tighten names in /admin/review.' />
            <WorkflowStep
              step='3'
              title='Guestbook'
              description='Clean up messages only when needed.'
            />
          </div>
        </div>

        <div className='rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <p className='text-[11px] uppercase tracking-[0.32em] text-charcoal-500'>Scope</p>
              <h3 className='mt-1 text-xl font-display text-charcoal-900'>What belongs here</h3>
            </div>
            <FolderOpen className='h-5 w-5 text-gold-500' aria-hidden='true' />
          </div>
          <p className='mt-4 text-sm leading-6 text-charcoal-600'>
            Admin is for moderation, people review, and verified site data. Traffic and error
            dashboards still live in Google Analytics and Sentry.
          </p>
          <div className='mt-4'>
            <AdminSectionLink
              section='settings'
              className={buttonVariants({ variant: 'secondary', className: 'gap-2' })}
            >
              Operating notes
              <ArrowRight className='h-4 w-4' aria-hidden='true' />
            </AdminSectionLink>
          </div>
        </div>
      </div>
    </div>
  )
}
