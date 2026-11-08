import { motion } from 'framer-motion'
import {
  BookOpen,
  CheckSquare,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Printer,
  Square,
} from 'lucide-react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import { cn } from '@/shared/lib/cn'
import { mediaPaths } from '@/shared/data/media'
import type { Photo } from '@/shared/data/photos'
import { Button } from '@/shared/ui/Button'
import {
  PRINT_COPY,
  PRINT_COUPLE_NAMES,
  PRINT_MAX_PHOTOS_NUMBER,
  PRINT_MAX_PHOTOS_SLIDER,
  PRINT_PAGE_CANONICAL,
  PRINT_PAGE_DESCRIPTION,
  PRINT_PAGE_TITLE,
  PRINT_WEDDING_DATE,
  clampPrintMaxPhotos,
  formatMessageCount,
  formatPhotoCount,
} from './printCopy'
import type { LoadPrintAlbumPhotos, LoadPrintGuestbook, PrintAlbumState } from './printTypes'
import { usePrintAlbums } from './usePrintAlbums'
import { usePrintGuestbook } from './usePrintGuestbook'
import './print.css'

/**
 * `/print` — Memory Book.
 *
 * Ported from the frozen `src/pages/Print.tsx` (legacy-freeze-2026-11-08):
 * same copy, class strings, DOM order and element structure, so text and pixel
 * parity hold. Print-only styles are ported verbatim in `./print.css`.
 *
 * Deliberate deltas (none visible):
 * - `usePageMeta` replaces `PrintSEO` (same title/description/canonical/noindex,
 *   and the rebuild's shared metadata hook is the Wave-1 equivalent).
 * - Decorative icons carry `aria-hidden`; toggle buttons are `type='button'`
 *   and expose `aria-pressed`; both max-photos inputs carry labels. These are
 *   ARIA/behaviour additions only — copy and layout are unchanged.
 * - `data-testid` hooks are added for parity/e2e assertions (Wave 4 harness).
 *
 * Route wiring (W4-4, Lead): mount this at `/print` and hide the shared
 * Header/Footer for the route — the frozen app skips both on `/print`
 * (`src/App.tsx:110,251`). This component renders no chrome of its own and
 * exposes the print container as `[data-testid='print-book']`.
 *
 * Data is provided by `usePrintAlbums` / `usePrintGuestbook`, whose default
 * loaders bind to the typed data layer (`@/shared/data`). Both loaders can be
 * injected via props for deterministic tests.
 */
export interface PrintPageProps {
  /** Override the album loader (defaults to `fetchAlbumPhotos`). */
  readonly loadAlbumPhotos?: LoadPrintAlbumPhotos
  /** Override the guestbook loader (defaults to `fetchGuestbookForPrint`). */
  readonly loadGuestbook?: LoadPrintGuestbook
}

function AlbumToggle({
  albumState,
  onToggle,
}: {
  albumState: PrintAlbumState
  onToggle: () => void
}) {
  const { album, included, loading, photos } = albumState

  return (
    <button
      type='button'
      onClick={onToggle}
      aria-pressed={included}
      data-testid={`print-album-toggle-${album}`}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
        included
          ? 'border-gold-400 bg-gold-50 text-charcoal-800'
          : 'border-charcoal-200 bg-white text-charcoal-500 hover:border-gold-300'
      )}
    >
      {included ? (
        <CheckSquare className='h-4 w-4 flex-shrink-0 text-gold-500' aria-hidden='true' />
      ) : (
        <Square className='h-4 w-4 flex-shrink-0' aria-hidden='true' />
      )}
      <span className='flex-1 text-sm font-medium'>{album}</span>
      {loading ? (
        <Loader2 className='h-3.5 w-3.5 animate-spin text-charcoal-400' aria-hidden='true' />
      ) : (
        <span className='text-xs text-charcoal-400'>{formatPhotoCount(photos.length)}</span>
      )}
    </button>
  )
}

function PrintPhotoGrid({
  photos,
  album,
  maxPhotos,
  isFirst = false,
}: {
  photos: readonly Photo[]
  album: string
  maxPhotos: number
  isFirst?: boolean
}) {
  const displayed = photos.slice(0, maxPhotos)
  if (displayed.length === 0) return null

  return (
    <div
      className={cn('album-section mb-10', isFirst && 'album-section--first')}
      data-testid={`print-album-section-${album}`}
    >
      <h2 className='mb-4 border-b border-charcoal-200 pb-2 font-display text-xl text-charcoal-700'>
        {album}
      </h2>
      <div className='photo-grid grid grid-cols-2 gap-4 sm:grid-cols-3'>
        {displayed.map(photo => (
          <div key={photo.id} className='photo-item'>
            <div className='aspect-[4/3] overflow-hidden rounded-lg bg-charcoal-100'>
              <img
                src={mediaPaths.getMediaPath(photo.thumbnail || photo.url)}
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

function GuestbookSection({
  messages,
}: {
  messages: readonly { id: string; name: string; content: string }[]
}) {
  if (messages.length === 0) return null

  return (
    <div className='guestbook-section pt-4' data-testid='print-guestbook-section'>
      <div className='mb-6 text-center'>
        <Heart className='mx-auto mb-2 h-5 w-5 text-rose-400' aria-hidden='true' />
        <h2 className='font-display text-2xl text-charcoal-800'>{PRINT_COPY.guestbookHeading}</h2>
        <p className='mt-1 text-sm text-charcoal-500'>{PRINT_WEDDING_DATE}</p>
      </div>
      <div className='columns-2 gap-6'>
        {messages.map(message => (
          <div
            key={message.id}
            className='message-item mb-4 break-inside-avoid rounded-lg border border-charcoal-100 bg-cream-50/60 px-4 py-3'
          >
            <p className='text-sm italic leading-relaxed text-charcoal-700'>
              &ldquo;{message.content}&rdquo;
            </p>
            <p className='mt-2 text-xs font-medium text-charcoal-500'>— {message.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PrintPage({ loadAlbumPhotos, loadGuestbook }: PrintPageProps = {}) {
  usePageMeta({
    title: PRINT_PAGE_TITLE,
    description: PRINT_PAGE_DESCRIPTION,
    canonical: PRINT_PAGE_CANONICAL,
    noIndex: true,
  })

  const {
    albumStates,
    includedAlbums,
    totalPhotoCount,
    maxPhotosPerAlbum,
    setMaxPhotosPerAlbum,
    toggleAlbum,
  } = usePrintAlbums({ loadAlbumPhotos })
  const {
    messages,
    loading: messagesLoading,
    includeGuestbook,
    toggleGuestbook,
  } = usePrintGuestbook({ loadGuestbook })

  const canPrint = totalPhotoCount > 0 || (includeGuestbook && messages.length > 0)

  return (
    <div className='min-h-screen bg-cream-50 pb-20' data-testid='print-page'>
      {/* Control panel — hidden on print */}
      <div className='no-print sticky top-0 z-20 border-b border-gold-200/60 bg-cream-50/95 backdrop-blur-sm'>
        <div className='mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3'>
          <div className='flex items-center gap-2'>
            <BookOpen className='h-4 w-4 text-gold-500' aria-hidden='true' />
            <span className='font-display text-base text-charcoal-800'>
              {PRINT_COPY.controlPanelTitle}
            </span>
          </div>
          <div className='flex items-center gap-3 text-xs text-charcoal-500'>
            {totalPhotoCount > 0 && (
              <span className='flex items-center gap-1'>
                <ImageIcon className='h-3.5 w-3.5' aria-hidden='true' />
                {formatPhotoCount(totalPhotoCount)}
              </span>
            )}
            {includeGuestbook && messages.length > 0 && (
              <span className='flex items-center gap-1'>
                <MessageCircle className='h-3.5 w-3.5' aria-hidden='true' />
                {formatMessageCount(messages.length)}
              </span>
            )}
          </div>
          <Button
            data-testid='print-button'
            onClick={() => window.print()}
            disabled={!canPrint}
            className='gap-1.5 bg-gold-500 text-white hover:bg-gold-600'
            size='sm'
          >
            <Printer className='h-4 w-4' aria-hidden='true' />
            {PRINT_COPY.printButtonLabel}
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
          data-testid='print-settings-panel'
        >
          <h2 className='mb-1 font-display text-lg text-charcoal-800'>
            {PRINT_COPY.settingsHeading}
          </h2>
          <p className='mb-5 text-sm text-charcoal-500'>
            {PRINT_COPY.settingsBodyBefore}
            <span className='font-medium text-charcoal-700'>
              {PRINT_COPY.settingsBodyHighlight}
            </span>
            {PRINT_COPY.settingsBodyAfter}
          </p>

          <p className='mb-2 text-xs font-medium uppercase tracking-wider text-charcoal-400'>
            {PRINT_COPY.photoAlbumsLabel}
          </p>
          <div className='grid gap-2 sm:grid-cols-2'>
            {albumStates.map(albumState => (
              <AlbumToggle
                key={albumState.album}
                albumState={albumState}
                onToggle={() => toggleAlbum(albumState.album)}
              />
            ))}
          </div>

          <div className='mt-4 border-t border-charcoal-100 pt-4'>
            <label className='mb-3 flex items-center justify-between'>
              <span className='text-xs font-medium uppercase tracking-wider text-charcoal-400'>
                {PRINT_COPY.maxPhotosLabel}
              </span>
              <div className='flex items-center gap-2'>
                <input
                  type='range'
                  min={PRINT_MAX_PHOTOS_SLIDER.min}
                  max={PRINT_MAX_PHOTOS_SLIDER.max}
                  step={PRINT_MAX_PHOTOS_SLIDER.step}
                  value={maxPhotosPerAlbum}
                  onChange={event => setMaxPhotosPerAlbum(Number(event.target.value))}
                  aria-label={`${PRINT_COPY.maxPhotosLabel} slider`}
                  data-testid='print-max-photos-slider'
                  className='w-28 accent-gold-500'
                />
                <input
                  type='number'
                  min={PRINT_MAX_PHOTOS_NUMBER.min}
                  max={PRINT_MAX_PHOTOS_NUMBER.max}
                  value={maxPhotosPerAlbum}
                  onChange={event =>
                    setMaxPhotosPerAlbum(clampPrintMaxPhotos(Number(event.target.value)))
                  }
                  aria-label={`${PRINT_COPY.maxPhotosLabel} number`}
                  data-testid='print-max-photos-number'
                  className='w-14 rounded-md border border-charcoal-200 px-2 py-1 text-center text-sm text-charcoal-700 focus:border-gold-400 focus:outline-none'
                />
              </div>
            </label>
          </div>

          <div className='mt-2 border-t border-charcoal-100 pt-4'>
            <button
              type='button'
              onClick={toggleGuestbook}
              aria-pressed={includeGuestbook}
              data-testid='print-guestbook-toggle'
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                includeGuestbook
                  ? 'border-gold-400 bg-gold-50 text-charcoal-800'
                  : 'border-charcoal-200 bg-white text-charcoal-500 hover:border-gold-300'
              )}
            >
              {includeGuestbook ? (
                <CheckSquare className='h-4 w-4 flex-shrink-0 text-gold-500' aria-hidden='true' />
              ) : (
                <Square className='h-4 w-4 flex-shrink-0' aria-hidden='true' />
              )}
              <span className='flex-1 text-sm font-medium'>{PRINT_COPY.guestbookToggleLabel}</span>
              {messagesLoading ? (
                <Loader2
                  className='h-3.5 w-3.5 animate-spin text-charcoal-400'
                  aria-hidden='true'
                />
              ) : (
                <span className='text-xs text-charcoal-400'>
                  {formatMessageCount(messages.length)}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Book content — this is what prints */}
        <div className='print-book' data-testid='print-book'>
          {/* Title */}
          <div className='mb-12 text-center'>
            <p className='mb-2 text-xs uppercase tracking-[0.25em] text-charcoal-400'>
              {PRINT_COPY.archiveEyebrow}
            </p>
            <h1 className='font-display text-4xl text-charcoal-900 sm:text-5xl'>
              {PRINT_COUPLE_NAMES}
            </h1>
            <p className='mt-3 font-display text-lg text-gold-600'>{PRINT_WEDDING_DATE}</p>
            <div className='mx-auto mt-6 h-px w-24 bg-gold-300' />
          </div>

          {/* Photo sections */}
          {includedAlbums.map((albumState, index) =>
            albumState.loading ? (
              <div
                key={albumState.album}
                className='no-print mb-10 flex items-center gap-2 text-sm text-charcoal-400'
              >
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
                {`${PRINT_COPY.loadingAlbumPrefix}${albumState.album}…`}
              </div>
            ) : (
              <PrintPhotoGrid
                key={albumState.album}
                photos={albumState.photos}
                album={albumState.album}
                maxPhotos={maxPhotosPerAlbum}
                isFirst={index === 0}
              />
            )
          )}

          {includedAlbums.length === 0 && (
            <div className='no-print mb-10 rounded-2xl border border-dashed border-charcoal-200 py-16 text-center text-charcoal-400'>
              <ImageIcon className='mx-auto mb-3 h-8 w-8 opacity-40' aria-hidden='true' />
              <p className='text-sm'>{PRINT_COPY.emptyBookMessage}</p>
            </div>
          )}

          {/* Guestbook */}
          {includeGuestbook && !messagesLoading && <GuestbookSection messages={messages} />}
          {includeGuestbook && messagesLoading && (
            <div className='no-print flex items-center gap-2 text-sm text-charcoal-400'>
              <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
              {PRINT_COPY.loadingGuestbookLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
