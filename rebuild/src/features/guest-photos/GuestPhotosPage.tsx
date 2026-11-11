/**
 * `/guest-photos` page — parity port of the frozen `src/pages/GuestPhotos.tsx`
 * (260 lines including its local Stat/Card/Skeleton/EmptyState components).
 *
 * Wave-6 scope: approved-only contact sheet, 2 stat cards, the "Share yours"
 * CTA, up to six featured thumbnails (scroll-reveal, reduced-motion aware),
 * upload cards (cover, name h2, CSS-uppercased date, photo-count pill, message,
 * extra-photo strip), loading skeleton, error and empty states, and the frozen
 * `/guest-photos` metadata (title, description, canonical, index-able).
 *
 * Data comes from `useGuestPhotosData`; the injected `GuestPhotosApi` is the
 * Lead's wiring seam (`shared/data/guestUploads.fetchApprovedGuestUploads`).
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Camera } from 'lucide-react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { GUEST_PHOTOS_COPY } from './constants'
import { useGuestPhotosData } from './data'
import { GuestPhotoCard } from './GuestPhotoCard'
import { getMediaPath } from './media'
import {
  GuestPhotosEmptyState,
  GuestPhotosErrorState,
  GuestPhotosSkeleton,
} from './GuestPhotosStates'
import { GuestPhotosStats } from './GuestPhotosStats'
import type { GuestPhotosApi } from './types'

export interface GuestPhotosPageProps {
  /** Data seam (Lead swaps for the `shared/data/guestUploads` adapter). */
  api?: GuestPhotosApi
}

export function GuestPhotosPage({ api }: GuestPhotosPageProps) {
  const { uploads, stats, featuredPhotos, isLoading, error } = useGuestPhotosData(
    api ? { api } : {}
  )
  const prefersReducedMotion = useReducedMotion()

  usePageMeta({
    title: GUEST_PHOTOS_COPY.metaTitle,
    description: GUEST_PHOTOS_COPY.metaDescription,
    canonical: GUEST_PHOTOS_COPY.canonical,
  })

  return (
    <div className='archive-noise min-h-screen pb-20 pt-28 sm:pt-32'>
      <section className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-end'>
          <div>
            <p className='theme-accent mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]'>
              <Camera className='h-4 w-4' aria-hidden='true' />
              {GUEST_PHOTOS_COPY.eyebrow}
            </p>
            <h1 className='max-w-3xl font-display text-4xl font-medium leading-[1.04] sm:text-6xl'>
              {GUEST_PHOTOS_COPY.title}
            </h1>
            <p className='theme-muted mt-5 max-w-2xl text-base leading-8'>
              {GUEST_PHOTOS_COPY.description}
            </p>
          </div>

          <GuestPhotosStats
            approvedUploads={stats.approvedUploads}
            guestPhotos={stats.guestPhotos}
          />
        </div>

        {featuredPhotos.length > 0 && (
          <div className='mt-10 grid grid-cols-3 gap-2 sm:grid-cols-6'>
            {featuredPhotos.map((photo, index) => (
              <motion.img
                key={`${photo.url}-${index}`}
                data-testid='guest-photo-featured'
                src={getMediaPath(photo.url)}
                alt={`Guest photo shared by ${photo.guestName}`}
                className='aspect-square rounded-xl border border-[color:var(--ui-border)] object-cover shadow-[var(--ui-shadow)]'
                width='240'
                height='240'
                loading={index < 3 ? 'eager' : 'lazy'}
                decoding='async'
                initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
              />
            ))}
          </div>
        )}
      </section>

      <section className='mx-auto mt-10 max-w-6xl px-4 sm:px-6' data-testid='guest-photos-list'>
        {isLoading ? (
          <GuestPhotosSkeleton />
        ) : error ? (
          <GuestPhotosErrorState />
        ) : uploads.length === 0 ? (
          <GuestPhotosEmptyState />
        ) : (
          <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {uploads.map((upload, index) => (
              <GuestPhotoCard key={upload.id} upload={upload} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default GuestPhotosPage
