/**
 * Frozen tab panels for the guest album.
 *
 * Photos panel (`src/pages/GuestShare.tsx:385-455`): 1/2/3-column grid of
 * 4:3 cards with the frozen hover overlay (caption, likes) and an empty state.
 *
 * Notes panel (`src/pages/GuestShare.tsx:458-534`): ruled-paper cards with the
 * date header, handwritten body, script signature and "With Love" caption.
 *
 * A11y delta vs the frozen page (intentional, recorded in the task report): the
 * photo cards are real `<button type='button'>` elements with an
 * `aria-label`/visible focus ring instead of clickable `<div>`s — the frozen
 * markup was mouse-only. Class strings are unchanged, so pixel parity holds.
 */
import { motion } from 'framer-motion'
import { BookOpen, Calendar, Eye, Heart, Image as ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NOTE_DATE_LOCALE, NOTE_DATE_OPTIONS, GUEST_SHARE_COPY } from './constants'
import type { GuestShareNote, GuestSharePhoto } from './types'

export interface GuestSharePhotosPanelProps {
  photos: GuestSharePhoto[]
  onPhotoOpen: (index: number) => void
}

export function GuestSharePhotosPanel({ photos, onPhotoOpen }: GuestSharePhotosPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='space-y-6'
      role='tabpanel'
      id='guest-share-panel-photos'
      aria-labelledby='guest-share-tab-photos'
      tabIndex={0}
    >
      {photos.length === 0 ? (
        <GuestSharePanelEmpty
          icon={<ImageIcon className='h-5 w-5' aria-hidden='true' />}
          title={GUEST_SHARE_COPY.noPhotosTitle}
          body={GUEST_SHARE_COPY.noPhotosBody}
        />
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
          {photos.map((photo, index) => (
            <motion.button
              type='button'
              key={photo.id}
              data-testid='guest-share-photo'
              aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
              className='group relative cursor-pointer overflow-hidden rounded-xl border border-gold-200/10 bg-white text-left shadow-sm hover:shadow-md hover:border-gold-300/40 transition-all duration-300 flex flex-col'
              onClick={() => onPhotoOpen(index)}
            >
              <div className='aspect-[4/3] w-full overflow-hidden bg-cream-50 relative'>
                <img
                  src={photo.thumbnail || photo.url}
                  alt={photo.caption || 'Guest photo contribution'}
                  className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                  loading='lazy'
                />
                <div className='absolute inset-0 bg-charcoal-950/10 opacity-100 transition-opacity duration-300' />

                {/* Hover Overlay */}
                <div className='absolute inset-0 bg-gradient-to-t from-charcoal-900/60 via-charcoal-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white'>
                  <span className='absolute top-3 right-3 bg-white/20 backdrop-blur-md rounded-full p-2 text-white hover:bg-white/35 transition-colors'>
                    <Eye className='h-4 w-4' aria-hidden='true' />
                  </span>

                  {photo.caption && (
                    <p className='text-sm font-sans truncate mb-1.5 font-medium'>{photo.caption}</p>
                  )}
                  <div className='flex items-center gap-4 text-xs'>
                    <span className='flex items-center gap-1'>
                      <Heart className='h-3.5 w-3.5 fill-current text-white' aria-hidden='true' />
                      {photo.likes || 0}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function GuestShareNotesPanel({ notes }: { notes: GuestShareNote[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='space-y-6'
      role='tabpanel'
      id='guest-share-panel-guestbook'
      aria-labelledby='guest-share-tab-guestbook'
      tabIndex={0}
    >
      {notes.length === 0 ? (
        <GuestSharePanelEmpty
          icon={<BookOpen className='h-5 w-5' aria-hidden='true' />}
          title={GUEST_SHARE_COPY.noNotesTitle}
          body={GUEST_SHARE_COPY.noNotesBody}
        />
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {notes.map((note, index) => (
            <motion.article
              key={note.id}
              data-testid='guest-share-note'
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
              className='relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gold-200/30 bg-[#FAF7F2] p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300'
              style={{
                backgroundImage: 'linear-gradient(rgba(212, 175, 55, 0.07) 1px, transparent 1px)',
                backgroundSize: '100% 2.25rem',
                lineHeight: '2.25rem',
              }}
            >
              {/* Note Header Card Details */}
              <div
                className='flex items-center justify-between border-b border-gold-500/10 pb-3 mb-6'
                style={{ lineHeight: 'normal' }}
              >
                <span className='text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600 font-sans flex items-center gap-1.5'>
                  <Calendar className='h-3.5 w-3.5 text-gold-500' aria-hidden='true' />
                  {new Intl.DateTimeFormat(NOTE_DATE_LOCALE, NOTE_DATE_OPTIONS).format(
                    new Date(note.createdAt)
                  )}
                </span>
                <span className='h-2 w-2 rounded-full bg-gold-400' />
              </div>

              {/* Handwritten content */}
              <div className='flex-1 my-2' style={{ lineHeight: '2.25rem' }}>
                <p className='font-serif italic text-charcoal-800 text-lg md:text-[19px] leading-9 whitespace-pre-wrap'>
                  {note.content}
                </p>
              </div>

              {/* Signature */}
              <div
                className='mt-8 flex flex-col items-end border-t border-gold-500/10 pt-4'
                style={{ lineHeight: 'normal' }}
              >
                <span className='font-script text-4xl sm:text-5xl text-gold-700 tracking-wide rotate-[-1.5deg] my-1'>
                  {note.name}
                </span>
                <span className='text-[9px] text-charcoal-400 uppercase tracking-widest font-sans font-medium mt-1'>
                  {GUEST_SHARE_COPY.withLove}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </motion.div>
  )
}

/** Frozen panel empty state (`GuestShare.tsx:393-404` and `:466-477`). */
function GuestSharePanelEmpty({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className='text-center py-20 bg-white/40 backdrop-blur-md rounded-2xl border border-gold-200/20 px-4'>
      <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 border border-gold-200/20 text-gold-600 mb-4'>
        {icon}
      </div>
      <h3 className='font-serif text-lg font-semibold text-charcoal-800'>{title}</h3>
      <p className='mt-2 text-sm text-charcoal-500 max-w-sm mx-auto font-sans leading-relaxed'>
        {body}
      </p>
    </div>
  )
}
