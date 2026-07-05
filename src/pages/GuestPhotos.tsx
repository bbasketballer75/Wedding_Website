import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Image as ImageIcon, Loader2, MessageCircle, Upload } from 'lucide-react'
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

  return (
    <div className='min-h-screen bg-cream-50 pb-20 pt-28 sm:pt-32'>
      <SEOHead
        title='Guest Photos'
        description='Browse the photos and notes shared by family and friends from Austin and Jordyn Porada wedding celebrations.'
        canonical='/guest-photos'
      />

      <section className='mx-auto max-w-6xl px-4 sm:px-6'>
        <div className='grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end'>
          <div>
            <p className='mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-600'>
              <Camera className='h-4 w-4' />
              Guest Memories
            </p>
            <h1 className='font-serif text-4xl font-semibold leading-tight text-charcoal-900 sm:text-5xl'>
              Photos from the people who were there
            </h1>
            <p className='mt-5 max-w-2xl text-base leading-8 text-charcoal-600'>
              A lighter archive view for the candid photos, table moments, and quick notes shared by
              family and friends after the celebration.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            <Stat label='Approved uploads' value={uploads.length} />
            <Stat label='Guest photos' value={photoCount} />
            <Link
              to='/upload'
              className='col-span-2 inline-flex min-h-24 items-center justify-center gap-2 rounded-lg border border-gold-300 bg-gold-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gold-700 sm:col-span-1'
            >
              <Upload className='h-4 w-4' />
              Share yours
            </Link>
          </div>
        </div>
      </section>

      <section className='mx-auto mt-10 max-w-6xl px-4 sm:px-6'>
        {loading ? (
          <div className='flex min-h-80 items-center justify-center rounded-lg border border-gold-200/60 bg-white/70'>
            <div className='text-center'>
              <Loader2 className='mx-auto h-8 w-8 animate-spin text-gold-600' />
              <p className='mt-3 text-sm text-charcoal-500'>Loading guest photos...</p>
            </div>
          </div>
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
            {uploads.map(upload => (
              <GuestUploadCard key={upload.id} upload={upload} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-lg border border-gold-200 bg-white/80 p-4 shadow-sm'>
      <div className='font-serif text-3xl font-semibold text-charcoal-900'>{value}</div>
      <div className='mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-500'>
        {label}
      </div>
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className='rounded-lg border border-gold-200/60 bg-white/75 px-6 py-16 text-center shadow-sm'>
      <ImageIcon className='mx-auto h-10 w-10 text-gold-500' />
      <h2 className='mt-5 font-serif text-2xl font-semibold text-charcoal-900'>{title}</h2>
      <p className='mx-auto mt-3 max-w-md text-sm leading-7 text-charcoal-600'>{message}</p>
    </div>
  )
}

function GuestUploadCard({ upload }: { upload: GuestUpload }) {
  const photos = upload.photo_urls ?? []
  const cover = photos[0]

  return (
    <article className='overflow-hidden rounded-lg border border-gold-200/70 bg-white shadow-sm'>
      {cover ? (
        <img
          src={getMediaPath(cover)}
          alt={`Shared by ${upload.guest_name}`}
          className='aspect-[4/3] w-full bg-cream-100 object-cover'
          width='640'
          height='480'
          loading='lazy'
          decoding='async'
        />
      ) : (
        <div className='flex aspect-[4/3] items-center justify-center bg-cream-100 text-gold-600'>
          <ImageIcon className='h-8 w-8' />
        </div>
      )}

      <div className='p-5'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='font-serif text-2xl font-semibold text-charcoal-900'>
              {upload.guest_name}
            </h2>
            <p className='mt-1 text-xs font-medium uppercase tracking-[0.14em] text-charcoal-400'>
              {formatUploadDate(upload.created_at)}
            </p>
          </div>
          <span className='rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700'>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {upload.message && (
          <p className='mt-4 flex gap-2 text-sm leading-7 text-charcoal-600'>
            <MessageCircle className='mt-1 h-4 w-4 shrink-0 text-gold-500' />
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
                className='aspect-square rounded-md bg-cream-100 object-cover'
                width='160'
                height='160'
                loading='lazy'
                decoding='async'
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
