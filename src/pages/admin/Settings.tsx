import {
  Image,
  Settings as SettingsIcon,
  BarChart3,
} from 'lucide-react'

export function Settings() {
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://www.theporadas.com'
  const mediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL || 'Not configured'

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-display text-charcoal-900">Operations Notes</h2>
        <p className="max-w-3xl text-sm leading-6 text-charcoal-500">
          This screen is intentionally read-only. It reflects the live setup and the moderation defaults that are
          already active, instead of pretending to save settings the site does not actually persist here.
        </p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gold-500" />
          Live Site Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-charcoal-600">
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-charcoal-400">Canonical site</p>
            <p className="mt-2 font-medium text-charcoal-900">{siteUrl}</p>
            <p className="mt-2 text-charcoal-500">This is the public URL guests should share and revisit.</p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-charcoal-400">Media host</p>
            <p className="mt-2 font-medium text-charcoal-900 break-all">{mediaBaseUrl}</p>
            <p className="mt-2 text-charcoal-500">Large video assets stream from the Cloudflare media host, not the frontend deploy.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-gold-500" />
          Moderation Defaults
        </h3>
        <div className="space-y-4">
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Guest uploads are live and require approval.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Uploads come in through the Share page, stay private during review, and now publish into the gallery only
              after curation in <span className="font-medium text-charcoal-700">/admin/photos</span>. Each moderation
              action is now recorded in the audit trail for future reference.
            </p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Guestbook stays open and self-service.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Guests can post text, voice, and video messages directly. Admin moderation is available later in
              <span className="font-medium text-charcoal-700"> /admin/guestbook</span> if cleanup is ever needed, and
              deletions now leave a moderation history behind.
            </p>
          </div>
          <div className="rounded-xl border border-gold-100 bg-cream-50/70 px-4 py-4">
            <p className="font-medium text-charcoal-900">Traffic analytics live outside the admin UI.</p>
            <p className="mt-2 text-sm text-charcoal-500">
              Google Analytics and Sentry remain the trustworthy sources for traffic, errors, and audience behavior.
              This admin area only shows database-backed counts and moderation workflow.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gold-100">
        <h3 className="font-medium text-charcoal-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gold-500" />
          Export and Backup Guidance
        </h3>
        <div className="space-y-3 text-sm leading-6 text-charcoal-500">
          <p>
            There is no in-app export button anymore because it was placeholder behavior. Use Supabase dashboard exports,
            SQL backups, or your storage providers directly when you need a real backup.
          </p>
          <p>
            The safest operating rhythm is simple: approve uploads, tag them into the right gallery lane, and let the
            public site reflect only content that has already been reviewed.
          </p>
        </div>
      </div>
    </div>
  )
}
