/**
 * Frozen stat grid (`src/pages/GuestPhotos.tsx:87-97`).
 *
 * Two stat cards plus the "Share yours" call-to-action, which occupies the
 * remaining cell on small/large screens exactly like the oracle
 * (`col-span-2 ... sm:col-span-1`). Labels are stored in sentence case and
 * uppercased by CSS to match the captured text oracle.
 */
import { Link } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { GUEST_PHOTOS_COPY } from './constants'

export function GuestPhotosStats({
  approvedUploads,
  guestPhotos,
}: {
  approvedUploads: number
  guestPhotos: number
}) {
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
      <Stat label={GUEST_PHOTOS_COPY.approvedUploadsLabel} value={approvedUploads} />
      <Stat label={GUEST_PHOTOS_COPY.guestPhotosLabel} value={guestPhotos} />
      <Link
        to={GUEST_PHOTOS_COPY.shareHref}
        className='col-span-2 inline-flex min-h-24 items-center justify-center gap-2 rounded-xl border border-[color:var(--ui-accent)] bg-[color:var(--ui-accent)] px-4 text-sm font-semibold text-charcoal-900 shadow-[var(--ui-shadow)] transition hover:-translate-y-0.5 hover:bg-[color:var(--ui-accent-strong)] sm:col-span-1'
      >
        <Upload className='h-4 w-4' aria-hidden='true' />
        {GUEST_PHOTOS_COPY.shareCta}
      </Link>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className='theme-panel rounded-xl p-4'>
      <div className='font-display text-3xl font-semibold'>{value}</div>
      <div className='theme-muted mt-1 text-xs font-semibold uppercase tracking-[0.14em]'>
        {label}
      </div>
    </div>
  )
}
