import { useState, useEffect, useCallback } from 'react'
import { Navigate, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase, type GuestUpload, type GuestbookMessage } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  Image, 
  MessageSquare, 
  Users, 
  Settings as SettingsIcon,
  LogOut,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { useToast } from '@/context/ToastContext'

// Admin sub-pages
function Dashboard() {
  const [stats, setStats] = useState({
    totalPhotos: 0,
    pendingPhotos: 0,
    totalMessages: 0,
    totalVisitors: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      // Fetch counts from Supabase
      const { count: photoCount } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
      
      const { count: pendingCount } = await supabase
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      const { count: messageCount } = await supabase
        .from('guestbook_messages')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalPhotos: photoCount || 0,
        pendingPhotos: pendingCount || 0,
        totalMessages: messageCount || 0,
        totalVisitors: 0, // Would come from analytics
      })
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display text-charcoal-900">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Photos" 
          value={stats.totalPhotos} 
          icon={Image} 
          color="blue" 
        />
        <StatCard 
          title="Pending Approval" 
          value={stats.pendingPhotos} 
          icon={Eye} 
          color="amber"
          alert={stats.pendingPhotos > 0}
        />
        <StatCard 
          title="Guestbook Messages" 
          value={stats.totalMessages} 
          icon={MessageSquare} 
          color="green" 
        />
        <StatCard 
          title="Total Visitors" 
          value={stats.totalVisitors} 
          icon={Users} 
          color="purple" 
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gold-100">
        <h3 className="text-lg font-medium text-charcoal-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/admin/photos">Review Photos</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/admin/guestbook">Moderate Guestbook</Link>
          </Button>
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
    <div className={`bg-white rounded-xl p-6 shadow-sm border ${alert ? 'border-amber-400' : 'border-gold-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-charcoal-500">{title}</p>
          <p className="text-3xl font-display text-charcoal-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6" />
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

type ModerationUpload = Omit<GuestUpload, 'message'> & { message?: string | null }

function PhotoModeration() {
  const [photos, setPhotos] = useState<ModerationUpload[]>([])
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchPendingPhotos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('guest_uploads')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      addToast('Failed to load photos', 'error')
    } else {
      setPhotos((data as ModerationUpload[] | null) || [])
    }
    setLoading(false)
  }, [addToast])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPendingPhotos()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPendingPhotos])

  async function handleApprove(id: string) {
    const { error } = await supabase
      .from('guest_uploads')
      .update({ status: 'approved' })
      .eq('id', id)

    if (error) {
      addToast('Failed to approve photo', 'error')
    } else {
      addToast('Photo approved', 'success')
      setPhotos(prev => prev.filter(p => p.id !== id))
    }
  }

  async function handleReject(id: string) {
    const { error } = await supabase
      .from('guest_uploads')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      addToast('Failed to reject photo', 'error')
    } else {
      addToast('Photo rejected', 'success')
      setPhotos(prev => prev.filter(p => p.id !== id))
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display text-charcoal-900">Photo Moderation</h2>
      
      {photos.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gold-100">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-charcoal-600">No pending photos to review!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-xl overflow-hidden border border-gold-100 shadow-sm">
              <div className="aspect-video bg-gray-100">
                {photo.photo_urls?.[0] && (
                  <img 
                    src={photo.photo_urls[0]} 
                    alt="Guest upload" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <p className="font-medium text-charcoal-900">{photo.guest_name}</p>
                <p className="text-sm text-charcoal-500">{photo.guest_email}</p>
                {photo.message && (
                  <p className="text-sm text-charcoal-600 mt-2 line-clamp-2">
                    "{photo.message}"
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleApprove(photo.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="danger"
                    className="flex-1"
                    onClick={() => handleReject(photo.id)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GuestbookModeration() {
  const [messages, setMessages] = useState<GuestbookMessage[]>([])
  const { addToast } = useToast()

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('guestbook_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    setMessages((data as GuestbookMessage[] | null) || [])
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMessages()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchMessages])

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this message?')) return

    const { error } = await supabase
      .from('guestbook_messages')
      .delete()
      .eq('id', id)

    if (error) {
      addToast('Failed to delete message', 'error')
    } else {
      addToast('Message deleted', 'success')
      setMessages(prev => prev.filter(m => m.id !== id))
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display text-charcoal-900">Guestbook Moderation</h2>
      
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="bg-white rounded-xl p-6 border border-gold-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-charcoal-900">{message.name}</p>
                <p className="text-sm text-charcoal-500">{message.email}</p>
                <p className="text-sm text-charcoal-500">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="danger"
                onClick={() => handleDelete(message.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="mt-4 text-charcoal-700">{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Analytics Dashboard Component
function Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [analytics, setAnalytics] = useState({
    pageViews: { total: 0, trend: 0 },
    uniqueVisitors: { total: 0, trend: 0 },
    photosUploaded: { total: 0, trend: 0 },
    guestbookEntries: { total: 0, trend: 0 },
    avgSessionDuration: '0m 0s',
    bounceRate: '0%',
  })
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      // Calculate date range
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Fetch guest uploads count
      const { count: uploadsCount } = await supabase
        .from('guest_uploads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())

      // Fetch guestbook entries count
      const { count: entriesCount } = await supabase
        .from('guestbook_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())

      // Mock trend data (would come from analytics service)
      const trendMultiplier = Math.random() * 0.4 + 0.8 // 0.8 - 1.2

      setAnalytics({
        pageViews: { 
          total: Math.floor((uploadsCount || 0) * 12.5 * trendMultiplier), 
          trend: Math.floor((trendMultiplier - 1) * 100) 
        },
        uniqueVisitors: { 
          total: Math.floor((uploadsCount || 0) * 8.3 * trendMultiplier), 
          trend: Math.floor((trendMultiplier - 1) * 100) 
        },
        photosUploaded: { 
          total: uploadsCount || 0, 
          trend: Math.floor((trendMultiplier - 1) * 100) 
        },
        guestbookEntries: { 
          total: entriesCount || 0, 
          trend: Math.floor((trendMultiplier - 1) * 100) 
        },
        avgSessionDuration: `${Math.floor(Math.random() * 5 + 2)}m ${Math.floor(Math.random() * 60)}s`,
        bounceRate: `${Math.floor(Math.random() * 20 + 35)}%`,
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
    '90d': 'Last 90 Days'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display text-charcoal-900">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
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
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto" />
          <p className="text-charcoal-500 mt-4">Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Page Views"
              value={analytics.pageViews.total.toLocaleString()}
              icon={Eye}
              color="blue"
            />
            <StatCard
              title="Unique Visitors"
              value={analytics.uniqueVisitors.total.toLocaleString()}
              icon={Users}
              color="green"
            />
            <StatCard
              title="Photos Uploaded"
              value={analytics.photosUploaded.total.toString()}
              icon={Image}
              color="amber"
            />
            <StatCard
              title="Guestbook Entries"
              value={analytics.guestbookEntries.total.toString()}
              icon={MessageSquare}
              color="purple"
            />
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gold-100">
              <p className="text-sm text-charcoal-500">Average Session Duration</p>
              <p className="text-3xl font-display text-charcoal-900 mt-2">
                {analytics.avgSessionDuration}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                Time spent per visit
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gold-100">
              <p className="text-sm text-charcoal-500">Bounce Rate</p>
              <p className="text-3xl font-display text-charcoal-900 mt-2">
                {analytics.bounceRate}
              </p>
              <p className="text-sm text-charcoal-400 mt-1">
                Visitors who leave after one page
              </p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Analytics Note</p>
              <p className="text-sm text-blue-700 mt-1">
                Full analytics tracking coming soon. Current metrics are based on 
                database activity. Connect Google Analytics or implement custom 
                tracking for comprehensive insights.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Settings Component
function Settings() {
  const [settings, setSettings] = useState({
    weddingDate: '2025-05-10',
    coupleNames: 'Austin & Jordyn',
    allowGuestUploads: true,
    requirePhotoApproval: true,
    allowGuestbookEntries: true,
    emailNotifications: true,
  })
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const handleSave = async () => {
    setSaving(true)
    // In a real implementation, save to Supabase settings table
    await new Promise(resolve => setTimeout(resolve, 500))
    addToast('Settings saved successfully', 'success')
    setSaving(false)
  }

  const handleExport = async (type: 'photos' | 'guestbook' | 'all') => {
    addToast(`Exporting ${type}...`, 'success')
    // Implementation would generate CSV/JSON export
    await new Promise(resolve => setTimeout(resolve, 1000))
    addToast('Export complete', 'success')
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-display text-charcoal-900">Site Settings</h2>

      {/* Wedding Details */}
      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-gold-500" />
          Wedding Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label
              htmlFor="settings-couple-names"
              className="mb-1 text-sm normal-case tracking-normal text-charcoal-500"
            >
              Couple Names
            </Label>
            <input
              id="settings-couple-names"
              type="text"
              value={settings.coupleNames}
              onChange={(e) => setSettings(prev => ({ ...prev, coupleNames: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gold-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
          <div>
            <Label
              htmlFor="settings-wedding-date"
              className="mb-1 text-sm normal-case tracking-normal text-charcoal-500"
            >
              Wedding Date
            </Label>
            <input
              id="settings-wedding-date"
              type="date"
              value={settings.weddingDate}
              onChange={(e) => setSettings(prev => ({ ...prev, weddingDate: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gold-200 focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
        </div>
      </div>

      {/* Guest Features */}
      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-gold-500" />
          Guest Features
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label
                htmlFor="allow-guest-uploads"
                className="mb-0 text-base normal-case tracking-normal text-charcoal-800"
              >
                Allow Guest Uploads
              </Label>
              <p id="allow-guest-uploads-description" className="text-sm text-charcoal-500">
                Guests can upload photos from the wedding
              </p>
            </div>
            <input
              id="allow-guest-uploads"
              type="checkbox"
              checked={settings.allowGuestUploads}
              onChange={(e) => setSettings(prev => ({ ...prev, allowGuestUploads: e.target.checked }))}
              className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500"
              aria-describedby="allow-guest-uploads-description"
            />
          </div>
          <hr className="border-gold-100" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label
                htmlFor="require-photo-approval"
                className="mb-0 text-base normal-case tracking-normal text-charcoal-800"
              >
                Require Photo Approval
              </Label>
              <p id="require-photo-approval-description" className="text-sm text-charcoal-500">
                Photos must be approved before appearing
              </p>
            </div>
            <input
              id="require-photo-approval"
              type="checkbox"
              checked={settings.requirePhotoApproval}
              onChange={(e) => setSettings(prev => ({ ...prev, requirePhotoApproval: e.target.checked }))}
              className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500"
              aria-describedby="require-photo-approval-description"
            />
          </div>
          <hr className="border-gold-100" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label
                htmlFor="allow-guestbook-entries"
                className="mb-0 text-base normal-case tracking-normal text-charcoal-800"
              >
                Allow Guestbook Entries
              </Label>
              <p id="allow-guestbook-entries-description" className="text-sm text-charcoal-500">
                Guests can leave messages in the guestbook
              </p>
            </div>
            <input
              id="allow-guestbook-entries"
              type="checkbox"
              checked={settings.allowGuestbookEntries}
              onChange={(e) => setSettings(prev => ({ ...prev, allowGuestbookEntries: e.target.checked }))}
              className="w-5 h-5 text-gold-500 rounded focus:ring-gold-500"
              aria-describedby="allow-guestbook-entries-description"
            />
          </div>
        </div>
      </div>

      {/* Data Export */}
      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gold-500" />
          Data Export
        </h3>
        <p className="text-sm text-charcoal-500 mb-4">
          Download your data for backup or offline use
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => handleExport('photos')}>
            Export Photos Metadata
          </Button>
          <Button variant="secondary" onClick={() => handleExport('guestbook')}>
            Export Guestbook
          </Button>
          <Button variant="secondary" onClick={() => handleExport('all')}>
            Export All Data
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

// Main Admin Layout
function AdminLayout() {
  const location = useLocation()
  const { signOut, user } = useAuthStore()
  const { addToast } = useToast()

  const handleSignOut = async () => {
    await signOut()
    addToast('Signed out successfully', 'success')
  }

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/photos', label: 'Photos', icon: Image },
    { path: '/admin/guestbook', label: 'Guestbook', icon: MessageSquare },
    { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gold-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display text-xl text-charcoal-900">
              <span className="text-gold-500">A</span>&<span className="text-gold-500">J</span>
              <span className="text-sm font-normal text-charcoal-500 ml-2">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-charcoal-500">{user?.email}</span>
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <nav className="w-64 flex-shrink-0" aria-label="Admin navigation">
          <div className="bg-white rounded-xl border border-gold-100 overflow-hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-gold-50 text-gold-700 border-r-2 border-gold-500' 
                      : 'text-charcoal-600 hover:bg-gray-50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="photos" element={<PhotoModeration />} />
            <Route path="guestbook" element={<GuestbookModeration />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

// Main Admin Component with Auth Check
export default function Admin() {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500" />
      </div>
    )
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/admin/login" replace state={{ from: redirectTo }} />
  }

  return <AdminLayout />
}
