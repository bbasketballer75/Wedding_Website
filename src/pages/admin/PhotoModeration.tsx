import { useEffect } from 'react'
import { Eye, CheckCircle, XCircle, Video } from 'lucide-react'
import { ComponentErrorBoundary } from '@/components/error/ErrorBoundary'
import { GuestUploadModerationList } from '@/components/admin/GuestUploadModerationList'
import { useModerationStore } from '@/stores/moderationStore'

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  alert,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: 'amber' | 'green' | 'purple' | 'blue'
  alert?: boolean
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }
  const iconColorMap = {
    amber: 'text-amber-500',
    green: 'text-green-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${colorMap[color]} ${
        alert ? 'ring-2 ring-amber-300' : ''
      }`}
    >
      <div className={`rounded-full bg-white/70 p-2 ${alert ? 'animate-pulse' : ''}`}>
        <Icon className={`h-5 w-5 ${iconColorMap[color]}`} />
      </div>
      <div>
        <p className="text-2xl font-display">{value}</p>
        <p className="text-xs opacity-80">{title}</p>
      </div>
    </div>
  )
}

export function PhotoModeration() {
  const { uploads, loadUploads } = useModerationStore()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUploads()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadUploads])

  const pending = uploads.filter((u) => u.status === 'pending').length
  const approved = uploads.filter((u) => u.status === 'approved').length
  const rejected = uploads.filter((u) => u.status === 'rejected').length

  return (
    <ComponentErrorBoundary componentName="Photo Moderation">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-display text-charcoal-900">Guest Upload Moderation</h2>
          <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
            Review guest photo submissions. Approve unique photos into the gallery, reject duplicates or
            inappropriate content, and optionally let guests know why their upload was declined.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Pending review" value={pending} icon={Eye} color="amber" alert={pending > 0} />
          <StatCard title="Approved" value={approved} icon={CheckCircle} color="green" />
          <StatCard title="Rejected" value={rejected} icon={XCircle} color="blue" />
        </div>

        <GuestUploadModerationList />
      </div>
    </ComponentErrorBoundary>
  )
}
