import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Image,
  MessageSquare,
  Eye,
  CheckCircle,
  ShieldCheck,
  FolderOpen,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import {
  supabase,
  fetchMediaReviewBatches,
  fetchGuestFaceTaggingBatches,
} from '@/lib/supabase'

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-charcoal-500">{label}</p>
          <p className="mt-2 text-lg font-medium text-charcoal-900 break-words">{value}</p>
        </div>
      </div>
      <p className="mt-1 text-sm leading-6 text-charcoal-600">{detail}</p>
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
    <div className="rounded-[1.1rem] border border-gold-100 bg-cream-50/70 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-semibold text-white">
          {step}
        </div>
        <div>
          <p className="text-sm font-medium text-charcoal-900">{title}</p>
          <p className="mt-1 text-sm leading-5 text-charcoal-500">{description}</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  alert = false
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
    <div className={`bg-white rounded-[1.2rem] p-4 shadow-sm border ${alert ? 'border-amber-400' : 'border-gold-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-charcoal-500">{title}</p>
          <p className="mt-1 text-[2rem] font-display leading-none text-charcoal-900">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {alert && (
        <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          Requires attention
        </p>
      )}
    </div>
  )
}

export function Dashboard() {
  const [stats, setStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    totalMessages: 0,
    approvedUploads: 0,
    peopleBatchesInFlight: 0,
    lastGuestTaggingSyncLabel: 'No guest sync yet',
  })

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: photoCount },
        { count: pendingCount },
        { count: messageCount },
        { count: approvedUploadCount },
        { data: mediaReviewBatches },
        { data: guestTaggingBatches },
      ] = await Promise.all([
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guestbook_messages').select('*', { count: 'exact', head: true }),
        supabase.from('guest_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        fetchMediaReviewBatches(),
        fetchGuestFaceTaggingBatches(),
      ])

      const latestGuestTaggingBatch = guestTaggingBatches?.[0] || null
      const peopleBatchesInFlight =
        (mediaReviewBatches || []).filter((batch) => batch.status === 'pending' || batch.status === 'in_review').length

      setStats({
        totalPhotos: photoCount || 0,
        pendingPhotos: pendingCount || 0,
        totalMessages: messageCount || 0,
        approvedUploads: approvedUploadCount || 0,
        peopleBatchesInFlight,
        lastGuestTaggingSyncLabel: latestGuestTaggingBatch?.last_synced_at
          ? new Date(latestGuestTaggingBatch.last_synced_at).toLocaleString()
          : 'No guest sync yet',
      })
    }

    void fetchStats()
  }, [])

  return (
    <ComponentErrorBoundary componentName="Dashboard">
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-gold-100 bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Austin + Jordyn control room</p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-charcoal-900 sm:text-[2rem]">
              A faster weekly view of what needs attention.
            </h2>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">
              Use this like a briefing, not a landing page: check the current state, then jump straight into the next
              workflow.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[24rem]">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/photos">Photos</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/albums">Albums</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/review">People Review</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/guestbook">Guestbook</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/audit">Audit</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminSignalRow
          label="Pending uploads"
          value={stats.pendingPhotos.toString()}
          tone={stats.pendingPhotos > 0 ? 'alert' : 'calm'}
          detail={stats.pendingPhotos > 0 ? 'Waiting in /admin/photos.' : 'Queue is clear.'}
        />
        <AdminSignalRow
          label="People review"
          value={stats.peopleBatchesInFlight.toString()}
          tone={stats.peopleBatchesInFlight > 0 ? 'alert' : 'calm'}
          detail={stats.peopleBatchesInFlight > 0 ? 'Batch still in flight.' : 'No active batch.'}
        />
        <AdminSignalRow
          label="Guest tagging sync"
          value={stats.lastGuestTaggingSyncLabel}
          tone="neutral"
          detail="Last metadata sync back into Gallery."
        />
        <AdminSignalRow
          label="Approved uploads"
          value={stats.approvedUploads.toString()}
          tone="neutral"
          detail="Ready to browse or face-tag later."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Live gallery photos"
          value={stats.totalPhotos}
          icon={Image}
          color="blue"
        />
        <StatCard
          title="Pending review"
          value={stats.pendingPhotos}
          icon={Eye}
          color="amber"
          alert={stats.pendingPhotos > 0}
        />
        <StatCard
          title="Guestbook entries"
          value={stats.totalMessages}
          icon={MessageSquare}
          color="green"
        />
        <StatCard
          title="Approved uploads"
          value={stats.approvedUploads}
          icon={CheckCircle}
          color="purple"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Recommended rhythm</p>
              <h3 className="mt-1 text-xl font-display text-charcoal-900">Three steps, in order</h3>
            </div>
            <ShieldCheck className="h-5 w-5 text-gold-500" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <WorkflowStep
              step="1"
              title="Photos"
              description="Clear /admin/photos first."
            />
            <WorkflowStep
              step="2"
              title="People"
              description="Tighten names in /admin/review."
            />
            <WorkflowStep
              step="3"
              title="Guestbook"
              description="Clean up messages only when needed."
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-gold-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-charcoal-500">Scope</p>
              <h3 className="mt-1 text-xl font-display text-charcoal-900">What belongs here</h3>
            </div>
            <FolderOpen className="h-5 w-5 text-gold-500" />
          </div>
          <p className="mt-4 text-sm leading-6 text-charcoal-600">
            Admin is for moderation, people review, and verified site data. Traffic and error
            dashboards still live in Google Analytics and Sentry.
          </p>
          <div className="mt-4">
            <Button variant="secondary" asChild>
              <Link to="/admin/settings">
                Operating notes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
    </ComponentErrorBoundary>
  )
}
