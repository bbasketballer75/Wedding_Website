import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Image as ImageIcon, MessageCircle, Upload } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { SEOHead } from '@/components/seo/SEOHead'
import { fetchApprovedGuestUploads } from '@/lib/supabase'
import type { GuestUpload } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'

const formatUploadDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))

export default function GuestPhotos() {
  const [uploads, setUploads] = useState<GuestUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    let mounted = true

    async function loadGuestUploads() {
      try {
        const approvedUploads = await fetchApprovedGuestUploads()
        if (!mounted) return
        setUploads(approvedUploads)
      } catch (err) {
        console.error('Failed to load guest photos:', err)
        if (mounted) setError(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadGuestUploads()

    return () => {
      mounted = false
    }
  }, [])

  const photoCount = useMemo(
    () => uploads.reduce((total, upload) => total + (upload.photo_urls?.length ?? 0), 0),
    [uploads]
  )
  const featuredPhotos = useMemo(
    () =>
      uploads
        .flatMap(upload =>
          (upload.photo_urls ?? []).map(url => ({
            url,
            guestName: upload.guest_name,
          }))
        )
        .slice(0, 6),
    [uploads]
  )

  return (
    <div className='archive-noise min-h-screen pb-20 pt-28 sm:pt-32'>
      <SEOHead
        title='Guest Photos'
        description='Browse the photos and notes shared by family and friends from Austin and Jordyn Porada wedding celebrations.'
        canonical='/guest-photos'
      />

      <section className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-end'>
          <div>
            <p className='theme-accent mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]'>
              <Camera className='h-4 w-4' />
              Guest Memories
            </p>
            <h1 className='max-w-3xl font-display text-4xl font-medium leading-[1.04] sm:text-6xl'>
              A contact sheet of the night as everyone saw it
            </h1>
            <p className='theme-muted mt-5 max-w-2xl text-base leading-8'>
              Candid tables, quick notes, blurry dance-floor joy, and the small details only guests
              could catch.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            <Stat label='Approved uploads' value={uploads.length} />
            <Stat label='Guest photos' value={photoCount} />
            <Link
              to='/upload'
              className='col-span-2 inline-flex min-h-24 items-center justify-center gap-2 rounded-xl border border-[color:var(--ui-accent)] bg-[color:var(--ui-accent)] px-4 text-sm font-semibold text-charcoal-900 shadow-[var(--ui-shadow)] transition hover:-translate-y-0.5 hover:bg-[color:var(--ui-accent-strong)] sm:col-span-1'
            >
              <Upload className='h-4 w-4' />
              Share yours
            </Link>
          </div>
        </div>

        {featuredPhotos.length > 0 && (
          <div className='mt-10 grid grid-cols-3 gap-2 sm:grid-cols-6'>
            {featuredPhotos.map((photo, index) => (
              <motion.img
                key={`${photo.url}-${index}`}
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

      <section className='mx-auto mt-10 max-w-6xl px-4 sm:px-6'>
        {loading ? (
          <GuestPhotoSkeleton />
        ) : error ? (
          <EmptyState
            title='Guest photos are taking a moment'
            message='The archive could not load approved guest uploads just now. Please refresh and try again.'
          />
        ) : uploads.length === 0 ? (
          <EmptyState
            title='No guest photos published yet'
            message='Approved guest uploads will appear here after moderation.'
          />
        ) : (
          <div className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {uploads.map((upload, index) => (
              <GuestUploadCard key={upload.id} upload={upload} index={index} />
            ))}
          </div>
        )}
      </section>
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

function GuestPhotoSkeleton() {
  return (
    <div
      className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
      role='status'
      aria-label='Loading guest photos'
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className='theme-panel overflow-hidden rounded-[1.15rem]'>
          <div className='theme-skeleton aspect-[4/3]' />
          <div className='space-y-3 p-5'>
            <div className='theme-skeleton h-7 w-2/3 rounded-full' />
            <div className='theme-skeleton h-4 w-32 rounded-full' />
            <div className='theme-skeleton h-4 w-full rounded-full' />
            <div className='theme-skeleton h-4 w-4/5 rounded-full' />
          </div>
        </div>
      ))}
      <span className='sr-only'>Loading guest photos...</span>
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className='theme-panel rounded-[1.25rem] px-6 py-16 text-center'>
      <ImageIcon className='mx-auto h-10 w-10 text-[color:var(--ui-accent)]' />
      <h2 className='mt-5 font-display text-2xl font-semibold'>{title}</h2>
      <p className='theme-muted mx-auto mt-3 max-w-md text-sm leading-7'>{message}</p>
    </div>
  )
}

function GuestUploadCard({ upload, index }: { upload: GuestUpload; index: number }) {
  const photos = upload.photo_urls ?? []
  const cover = photos[0]
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.article
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
          alt={`Shared by ${upload.guest_name}`}
          className='aspect-[4/3] w-full bg-[color:var(--ui-canvas-soft)] object-cover transition duration-700 group-hover:scale-[1.035]'
          width='640'
          height='480'
          loading='lazy'
          decoding='async'
        />
      ) : (
        <div className='flex aspect-[4/3] items-center justify-center bg-[color:var(--ui-surface)] text-[color:var(--ui-accent)]'>
          <ImageIcon className='h-8 w-8' />
        </div>
      )}

      <div className='p-5'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='font-display text-2xl font-semibold'>{upload.guest_name}</h2>
            <p className='theme-subtle mt-1 text-xs font-medium uppercase tracking-[0.12em]'>
              {formatUploadDate(upload.created_at)}
            </p>
          </div>
          <span className='rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--ui-accent-strong)]'>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {upload.message && (
          <p className='theme-muted mt-4 flex gap-2 text-sm leading-7'>
            <MessageCircle className='mt-1 h-4 w-4 shrink-0 text-[color:var(--ui-accent)]' />
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
