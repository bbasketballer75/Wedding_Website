/**
 * /print — Memory Book
 *
 * A print-optimised page that lets guests or the couple produce:
 *   1. A photo book from any combination of albums
 *   2. A guestbook keepsake of all messages
 *
 * Uses the browser's native print dialog — any PDF printer works.
 * The control panel is hidden via @media print; only the book content prints.
 */
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  MessageCircle,
  Printer,
  CheckSquare,
  Square,
  Loader2,
  Heart,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PrintSEO } from '@/components/seo/SEOHead'
import {
  supabase,
  fetchAlbumPhotos,
  PHOTO_ALBUMS,
  type Photo,
  type GuestbookMessage,
  type PhotoAlbum,
} from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import { cn } from '@/lib/utils'
import './print.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const WEDDING_DATE = 'May 10, 2025'
const COUPLE_NAMES = 'Austin & Jordyn Porada'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlbumState {
  album: PhotoAlbum
  included: boolean
  photos: Photo[]
  loading: boolean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlbumToggle({ albumState, onToggle }: { albumState: AlbumState; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
        albumState.included
          ? 'border-gold-400 bg-gold-50 text-charcoal-800'
          : 'border-charcoal-200 bg-white text-charcoal-500 hover:border-gold-300'
      )}
    >
      {albumState.included ? (
        <CheckSquare className='h-4 w-4 flex-shrink-0 text-gold-500' />
      ) : (
        <Square className='h-4 w-4 flex-shrink-0' />
      )}
      <span className='flex-1 text-sm font-medium'>{albumState.album}</span>
      {albumState.loading ? (
        <Loader2 className='h-3.5 w-3.5 animate-spin text-charcoal-400' />
      ) : (
        <span className='text-xs text-charcoal-400'>{albumState.photos.length} photos</span>
      )}
    </button>
  )
}

function PhotoGrid({
  photos,
  album,
  maxPhotos,
}: {
  photos: Photo[]
  album: string
  maxPhotos: number
}) {
  const displayed = photos.slice(0, maxPhotos)
  if (displayed.length === 0) return null
  return (
    <div className='album-section mb-10'>
      <h2 className='mb-4 border-b border-charcoal-200 pb-2 font-display text-xl text-charcoal-700'>
        {album}
      </h2>
      <div className='photo-grid grid grid-cols-2 gap-4 sm:grid-cols-3'>
        {displayed.map(photo => (
          <div key={photo.id} className='photo-item'>
            <div className='aspect-[4/3] overflow-hidden rounded-lg bg-charcoal-100'>
              <img
                src={getMediaPath(photo.thumbnail || photo.url)}
                alt={photo.caption || `${album} photo`}
                className='h-full w-full object-cover'
                loading='eager'
              />
            </div>
            {photo.caption && (
              <p className='mt-1.5 text-xs italic leading-snug text-charcoal-500'>
                {photo.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GuestbookSection({ messages }: { messages: GuestbookMessage[] }) {
  if (messages.length === 0) return null
  return (
    <div className='guestbook-section pt-4'>
      <div className='mb-6 text-center'>
        <Heart className='mx-auto mb-2 h-5 w-5 text-rose-400' />
        <h2 className='font-display text-2xl text-charcoal-800'>Words from our guests</h2>
        <p className='mt-1 text-sm text-charcoal-500'>{WEDDING_DATE}</p>
      </div>
      <div className='columns-2 gap-6'>
        {messages.map(msg => (
          <div
            key={msg.id}
            className='message-item mb-4 break-inside-avoid rounded-lg border border-charcoal-100 bg-cream-50/60 px-4 py-3'
          >
            <p className='text-sm italic leading-relaxed text-charcoal-700'>
              &ldquo;{msg.content}&rdquo;
            </p>
            <p className='mt-2 text-xs font-medium text-charcoal-500'>— {msg.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Print() {
  const [albumStates, setAlbumStates] = useState<AlbumState[]>(() =>
    PHOTO_ALBUMS.map(album => ({
      album,
      included: album === 'Wedding Day',
      photos: [],
      loading: false,
    }))
  )
  const [messages, setMessages] = useState<GuestbookMessage[]>([])
  const [includeGuestbook, setIncludeGuestbook] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [maxPhotosPerAlbum, setMaxPhotosPerAlbum] = useState(40)

  const loadAlbum = useCallback(async (album: PhotoAlbum) => {
    setAlbumStates(prev => prev.map(s => (s.album === album ? { ...s, loading: true } : s)))
    const result = await fetchAlbumPhotos(album)
    setAlbumStates(prev =>
      prev.map(s => (s.album === album ? { ...s, photos: result.data ?? [], loading: false } : s))
    )
  }, [])

  // Pre-load the default album on mount
  useEffect(() => {
    void loadAlbum('Wedding Day')
  }, [loadAlbum])

  // Fetch guestbook messages once
  useEffect(() => {
    setMessagesLoading(true)
    void supabase
      .from('guestbook_messages')
      .select('id, name, content, created_at')
      .order('created_at', { ascending: true })
      .returns<GuestbookMessage[]>()
      .then(({ data }) => {
        setMessages(data ?? [])
        setMessagesLoading(false)
      })
  }, [])

  const toggleAlbum = useCallback(
    (album: PhotoAlbum) => {
      const current = albumStates.find(s => s.album === album)
      if (!current) return
      const nowIncluded = !current.included
      setAlbumStates(prev =>
        prev.map(s => (s.album === album ? { ...s, included: nowIncluded } : s))
      )
      if (nowIncluded && current.photos.length === 0) {
        void loadAlbum(album)
      }
    },
    [albumStates, loadAlbum]
  )

  const includedAlbums = albumStates.filter(s => s.included)
  const totalPhotoCount = includedAlbums.reduce(
    (sum, s) => sum + Math.min(s.photos.length, maxPhotosPerAlbum),
    0
  )
  const canPrint = totalPhotoCount > 0 || (includeGuestbook && messages.length > 0)

  return (
    <>
      <PrintSEO />

      <div className='min-h-screen bg-cream-50 pb-20'>
        {/* Control panel — hidden on print */}
        <div className='no-print sticky top-0 z-20 border-b border-gold-200/60 bg-cream-50/95 backdrop-blur-sm'>
          <div className='mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3'>
            <div className='flex items-center gap-2'>
              <BookOpen className='h-4 w-4 text-gold-500' />
              <span className='font-display text-base text-charcoal-800'>Memory Book</span>
            </div>
            <div className='flex items-center gap-3 text-xs text-charcoal-500'>
              {totalPhotoCount > 0 && (
                <span className='flex items-center gap-1'>
                  <ImageIcon className='h-3.5 w-3.5' />
                  {totalPhotoCount} photos
                </span>
              )}
              {includeGuestbook && messages.length > 0 && (
                <span className='flex items-center gap-1'>
                  <MessageCircle className='h-3.5 w-3.5' />
                  {messages.length} messages
                </span>
              )}
            </div>
            <Button
              onClick={() => window.print()}
              disabled={!canPrint}
              className='gap-1.5 bg-gold-500 text-white hover:bg-gold-600'
              size='sm'
            >
              <Printer className='h-4 w-4' />
              Print / Save PDF
            </Button>
          </div>
        </div>

        <div className='mx-auto max-w-4xl px-4 pt-8'>
          {/* Settings panel — hidden on print */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className='no-print mb-10 rounded-2xl border border-gold-200/60 bg-white p-6 shadow-sm'
          >
            <h2 className='mb-1 font-display text-lg text-charcoal-800'>Choose what to include</h2>
            <p className='mb-5 text-sm text-charcoal-500'>
              Select albums and sections, then click{' '}
              <span className='font-medium text-charcoal-700'>Print / Save PDF</span>. Your
              browser&apos;s print dialog lets you save as a PDF or send to any printer.
            </p>

            <p className='mb-2 text-xs font-medium uppercase tracking-wider text-charcoal-400'>
              Photo albums
            </p>
            <div className='grid gap-2 sm:grid-cols-2'>
              {albumStates.map(s => (
                <AlbumToggle key={s.album} albumState={s} onToggle={() => toggleAlbum(s.album)} />
              ))}
            </div>

            <div className='mt-4 border-t border-charcoal-100 pt-4'>
              <label className='mb-3 flex items-center justify-between'>
                <span className='text-xs font-medium uppercase tracking-wider text-charcoal-400'>
                  Max photos per album
                </span>
                <div className='flex items-center gap-2'>
                  <input
                    type='range'
                    min={6}
                    max={200}
                    step={2}
                    value={maxPhotosPerAlbum}
                    onChange={e => setMaxPhotosPerAlbum(Number(e.target.value))}
                    className='w-28 accent-gold-500'
                  />
                  <input
                    type='number'
                    min={1}
                    max={500}
                    value={maxPhotosPerAlbum}
                    onChange={e =>
                      setMaxPhotosPerAlbum(Math.max(1, Math.min(500, Number(e.target.value))))
                    }
                    className='w-14 rounded-md border border-charcoal-200 px-2 py-1 text-center text-sm text-charcoal-700 focus:border-gold-400 focus:outline-none'
                  />
                </div>
              </label>
            </div>

            <div className='mt-2 border-t border-charcoal-100 pt-4'>
              <button
                onClick={() => setIncludeGuestbook(v => !v)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                  includeGuestbook
                    ? 'border-gold-400 bg-gold-50 text-charcoal-800'
                    : 'border-charcoal-200 bg-white text-charcoal-500 hover:border-gold-300'
                )}
              >
                {includeGuestbook ? (
                  <CheckSquare className='h-4 w-4 flex-shrink-0 text-gold-500' />
                ) : (
                  <Square className='h-4 w-4 flex-shrink-0' />
                )}
                <span className='flex-1 text-sm font-medium'>Guestbook messages</span>
                {messagesLoading ? (
                  <Loader2 className='h-3.5 w-3.5 animate-spin text-charcoal-400' />
                ) : (
                  <span className='text-xs text-charcoal-400'>{messages.length} messages</span>
                )}
              </button>
            </div>
          </motion.div>

          {/* Book content — this is what prints */}
          <div className='print-book'>
            {/* Title */}
            <div className='mb-12 text-center'>
              <p className='mb-2 text-xs uppercase tracking-[0.25em] text-charcoal-400'>
                A wedding archive
              </p>
              <h1 className='font-display text-4xl text-charcoal-900 sm:text-5xl'>
                {COUPLE_NAMES}
              </h1>
              <p className='mt-3 font-display text-lg text-gold-600'>{WEDDING_DATE}</p>
              <div className='mx-auto mt-6 h-px w-24 bg-gold-300' />
            </div>

            {/* Photo sections */}
            {includedAlbums.map(s =>
              s.loading ? (
                <div
                  key={s.album}
                  className='no-print mb-10 flex items-center gap-2 text-sm text-charcoal-400'
                >
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading {s.album}…
                </div>
              ) : (
                <PhotoGrid
                  key={s.album}
                  photos={s.photos}
                  album={s.album}
                  maxPhotos={maxPhotosPerAlbum}
                />
              )
            )}

            {includedAlbums.length === 0 && (
              <div className='no-print mb-10 rounded-2xl border border-dashed border-charcoal-200 py-16 text-center text-charcoal-400'>
                <ImageIcon className='mx-auto mb-3 h-8 w-8 opacity-40' />
                <p className='text-sm'>Select at least one album above to include photos.</p>
              </div>
            )}

            {/* Guestbook */}
            {includeGuestbook && !messagesLoading && <GuestbookSection messages={messages} />}
            {includeGuestbook && messagesLoading && (
              <div className='no-print flex items-center gap-2 text-sm text-charcoal-400'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Loading guestbook…
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
