/**
 * Frozen identity header card (`src/pages/GuestShare.tsx:271-335`): back link,
 * glass card, "Guest Memory Album" eyebrow, `<h1>{name}'s Showcase</h1>`, the
 * photos/messages stat line and the copy-link button that flips to
 * "Copied Album Link" for two seconds after a successful copy.
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Check, Copy, Share2 } from 'lucide-react'
import { GUEST_SHARE_COPY } from './constants'

export interface GuestShareIdentityHeaderProps {
  guestName: string
  photoCount: number
  noteCount: number
  copied: boolean
  onCopy: () => void
}

export function GuestShareIdentityHeader({
  guestName,
  photoCount,
  noteCount,
  copied,
  onCopy,
}: GuestShareIdentityHeaderProps) {
  return (
    <>
      {/* Frozen "Navigation back link" (`GuestShare.tsx:280-287`). */}
      <Link
        to={GUEST_SHARE_COPY.galleryHref}
        className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal-500 hover:text-gold-600 transition-colors mb-6 font-sans group'
      >
        <ArrowLeft
          className='h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform'
          aria-hidden='true'
        />
        {GUEST_SHARE_COPY.backToGallery}
      </Link>

      {/* Top Header Card — frozen glassmorphism markup. */}
      <div className='relative overflow-hidden rounded-2xl border border-gold-200/40 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-md mb-8'>
        <div className='absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gold-500/5 blur-2xl pointer-events-none' />

        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative z-10'>
          <div className='space-y-2'>
            <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-gold-600 font-semibold font-sans'>
              <Share2 className='h-3.5 w-3.5' aria-hidden='true' /> {GUEST_SHARE_COPY.eyebrow}
            </span>
            <h1 className='font-serif text-3xl sm:text-4xl font-semibold text-charcoal-900'>
              {guestName}
              {GUEST_SHARE_COPY.titleSuffix}
            </h1>
            <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-500 font-sans'>
              <span className='font-medium'>{GUEST_SHARE_COPY.photosShared(photoCount)}</span>
              <span className='text-gold-400'>{GUEST_SHARE_COPY.bullet}</span>
              <span className='font-medium'>{GUEST_SHARE_COPY.messagesWritten(noteCount)}</span>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={onCopy}
              className='inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gold-200 hover:bg-gold-50 text-gold-800 font-medium text-xs px-4 py-2.5 transition-colors shadow-sm'
            >
              {copied ? (
                <>
                  <Check className='h-3.5 w-3.5 text-emerald-500' aria-hidden='true' />
                  {GUEST_SHARE_COPY.copiedCta}
                </>
              ) : (
                <>
                  <Copy className='h-3.5 w-3.5' aria-hidden='true' />
                  {GUEST_SHARE_COPY.shareCta}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
