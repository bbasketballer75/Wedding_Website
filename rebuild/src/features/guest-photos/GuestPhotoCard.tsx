/**
 * Frozen upload card (`src/pages/GuestPhotos.tsx:191-260`).
 *
 * Card anatomy, class strings and copy are the oracle's: cover image (4:3),
 * guest name (h2), CSS-uppercased date, photo-count pill, optional message with
 * the message icon, and the 4-up extra-photo strip when an upload has >1 photo.
 * `motion.article` scroll-reveal/hover is disabled under reduced motion like the
 * frozen component.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, MessageCircle } from 'lucide-react'
import { formatUploadDate } from './data'
import { getMediaPath } from './media'
import type { GuestPhotoUpload } from './types'

export function GuestPhotoCard({ upload, index }: { upload: GuestPhotoUpload; index: number }) {
  const photos = upload.photoUrls
  const cover = photos[0]
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.article
      data-testid='guest-photo-card'
      className='theme-card group overflow-hidden rounded-[1.15rem]'
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8%' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.28) }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
    >
      {cover ? (
        <img
          src={getMediaPath(cover)}
          alt={`Shared by ${upload.guestName}`}
          className='aspect-[4/3] w-full bg-[color:var(--ui-canvas-soft)] object-cover transition duration-700 group-hover:scale-[1.035]'
          width='640'
          height='480'
          loading='lazy'
          decoding='async'
        />
      ) : (
        <div className='flex aspect-[4/3] items-center justify-center bg-[color:var(--ui-surface)] text-[color:var(--ui-accent)]'>
          <ImageIcon className='h-8 w-8' aria-hidden='true' />
        </div>
      )}

      <div className='p-5'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='font-display text-2xl font-semibold'>{upload.guestName}</h2>
            <p className='theme-subtle mt-1 text-xs font-medium uppercase tracking-[0.12em]'>
              {formatUploadDate(upload.createdAt)}
            </p>
          </div>
          <span className='rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ui-accent-strong)]'>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {upload.message && (
          <p className='theme-muted mt-4 flex gap-2 text-sm leading-7'>
            <MessageCircle
              className='mt-1 h-4 w-4 shrink-0 text-[color:var(--ui-accent)]'
              aria-hidden='true'
            />
            <span>{upload.message}</span>
          </p>
        )}

        {photos.length > 1 && (
          <div className='mt-4 grid grid-cols-4 gap-2'>
            {photos.slice(1, 5).map(url => (
              <img
                key={url}
                src={getMediaPath(url)}
                alt=''
                aria-hidden='true'
                className='aspect-square rounded-md border border-[color:var(--ui-border)] bg-[color:var(--ui-canvas-soft)] object-cover'
                width='160'
                height='160'
                loading='lazy'
                decoding='async'
              />
            ))}
          </div>
        )}
      </div>
    </motion.article>
  )
}
